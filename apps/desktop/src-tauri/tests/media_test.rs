use kobean_core::db::{
    create_case, create_project, create_run, create_suite, create_workspace, get_run_items,
    record_execution, run_migrations, CreateCaseInput, CreateRunInput, RecordExecutionInput,
};
use kobean_core::media::{
    calculate_media_dir_size, decode_base64, enforce_quota, parse_data_url, read_media_file,
    save_media_file, SaveMediaInput,
};
use rusqlite::Connection;
use tempfile::tempdir;

#[test]
fn test_base64_decode_and_data_url_parsing() {
    let raw = "Hello, KobeanTest!";
    // "Hello, KobeanTest!" in base64 is "SGVsbG8sIEtvYmVhblRlc3Qh"
    let encoded = "SGVsbG8sIEtvYmVhblRlc3Qh";
    let decoded = decode_base64(encoded).unwrap_or_default();
    assert_eq!(String::from_utf8_lossy(&decoded), raw);

    let data_url = "data:image/png;base64,SGVsbG8sIEtvYmVhblRlc3Qh";
    let (payload, mime) = parse_data_url(data_url);
    assert_eq!(payload, encoded);
    assert_eq!(mime, Some("image/png"));
}

#[test]
fn test_media_save_and_read_with_permissions() {
    let dir = tempdir().unwrap_or_else(|e| panic!("failed to create temp dir: {e}"));
    let media_dir = dir.path().join("media");

    let mut conn = Connection::open_in_memory().unwrap_or_else(|e| panic!("failed to open in memory db: {e}"));
    run_migrations(&mut conn).unwrap_or_else(|e| panic!("migrations failed: {e}"));

    let ws = create_workspace(&conn, "Default Workspace", "default")
        .unwrap_or_else(|e| panic!("create workspace failed: {e}"));

    let project = create_project(&conn, &ws.id, "Media Proj", "MED", None)
        .unwrap_or_else(|e| panic!("create project failed: {e}"));

    let suite = create_suite(&conn, &project.id, None, "Suite 1", None, Some(1))
        .unwrap_or_else(|e| panic!("create suite failed: {e}"));

    let case = create_case(
        &conn,
        CreateCaseInput {
            project_id: project.id.clone(),
            suite_id: Some(suite.id),
            title: "Case 1".to_string(),
            preconditions: None,
            steps_json: None,
            priority: Some("medium".to_string()),
            type_: Some("manual".to_string()),
            automation_id: None,
            tags_json: None,
        },
    )
    .unwrap_or_else(|e| panic!("create case failed: {e}"));

    let run = create_run(
        &mut conn,
        CreateRunInput {
            project_id: project.id,
            title: "Run 1".to_string(),
            environment: Some("test".to_string()),
            source: Some("manual".to_string()),
            idempotency_key: Some("run-media-1".to_string()),
            commit_sha: None,
            branch: None,
            case_ids: vec![case.id],
            ..Default::default()
        },
    )
    .unwrap_or_else(|e| panic!("create run failed: {e}"));

    let run_items = get_run_items(&conn, &run.id).unwrap_or_default();
    assert_eq!(run_items.len(), 1);

    let execution = record_execution(
        &mut conn,
        RecordExecutionInput {
            run_item_id: run_items[0].item.id.clone(),
            status: "failed".to_string(),
            duration_ms: Some(250),
            error_message: Some("Screenshot test".to_string()),
            stack_trace: None,
            notes: None,
            executed_by: None,
            step_results: Some(vec![kobean_core::db::RecordStepResultInput {
                step_number: 1,
                status: "failed".to_string(),
                actual_result: Some("Assertion failure on step 1".to_string()),
            }]),
        },
    )
    .unwrap_or_else(|e| panic!("record execution failed: {e}"));

    let input = SaveMediaInput {
        execution_id: execution.id.clone(),
        step_number: Some(1),
        file_name: "screenshot.png".to_string(),
        mime_type: "image/png".to_string(),
        data_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==".to_string(),
    };

    let attachment = save_media_file(&conn, &media_dir, &input, 10 * 1024 * 1024)
        .unwrap_or_else(|e| panic!("save media failed: {e}"));

    assert_eq!(attachment.execution_id, execution.id);
    assert_eq!(attachment.mime_type, "image/png");
    assert!(attachment.file_size_bytes > 0);

    // Read back
    let filename = std::path::Path::new(&attachment.file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let (bytes, mime) = read_media_file(&media_dir, &filename)
        .unwrap_or_else(|e| panic!("read media failed: {e}"));
    assert_eq!(mime, "image/png");
    assert_eq!(bytes.len() as i64, attachment.file_size_bytes);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let file_meta = std::fs::metadata(&attachment.file_path).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(file_meta.permissions().mode() & 0o777, 0o600);

        let dir_meta = std::fs::metadata(&media_dir).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(dir_meta.permissions().mode() & 0o777, 0o700);
    }
}

#[test]
fn test_quota_enforcement_and_lru_eviction() {
    let dir = tempdir().unwrap_or_else(|e| panic!("tempdir error: {e}"));
    let media_dir = dir.path().join("media");
    std::fs::create_dir_all(&media_dir).unwrap_or_default();

    // Create 3 dummy files with staggered modification times
    let file1 = media_dir.join("oldest.png");
    let file2 = media_dir.join("middle.png");
    let file3 = media_dir.join("newest.png");

    std::fs::write(&file1, [1u8; 100]).unwrap_or_default();
    std::thread::sleep(std::time::Duration::from_millis(50));
    std::fs::write(&file2, [2u8; 100]).unwrap_or_default();
    std::thread::sleep(std::time::Duration::from_millis(50));
    std::fs::write(&file3, [3u8; 100]).unwrap_or_default();

    let total = calculate_media_dir_size(&media_dir).unwrap_or_default();
    assert_eq!(total, 300);

    // Enforce quota of 250 bytes with incoming 100 bytes
    // Total needed capacity: 250 max. Existing: 300. Incoming: 100.
    // Eviction must purge oldest.png (100) and middle.png (100) so remaining (100) + incoming (100) = 200 <= 250.
    enforce_quota(&media_dir, 100, 250).unwrap_or_else(|e| panic!("enforce quota failed: {e}"));

    assert!(!file1.exists(), "oldest file should have been evicted");
    assert!(!file2.exists(), "middle file should have been evicted");
    assert!(file3.exists(), "newest file should be preserved");

    let remaining = calculate_media_dir_size(&media_dir).unwrap_or_default();
    assert_eq!(remaining, 100);
}

#[test]
fn test_path_traversal_guards() {
    let dir = tempdir().unwrap_or_else(|e| panic!("tempdir error: {e}"));
    let media_dir = dir.path().join("media");
    std::fs::create_dir_all(&media_dir).unwrap_or_default();

    assert!(read_media_file(&media_dir, "../secret.txt").is_err());
    assert!(read_media_file(&media_dir, "/etc/passwd").is_err());
    assert!(read_media_file(&media_dir, "nested/file.png").is_err());
    assert!(read_media_file(&media_dir, "nested\\file.png").is_err());
}
