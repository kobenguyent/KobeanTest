use kobean_core::db::{
    create_project, create_workspace, get_run, ingest_batch, run_migrations,
    IngestAttachmentInput, IngestBatchInput, IngestCaseResult,
};
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("In-memory test DB open");
    run_migrations(&conn).expect("Migrations run cleanly");
    conn
}

#[test]
fn test_ci_ingest_idempotency_and_case_auto_provisioning() {
    let mut conn = setup_test_db();

    let ws = create_workspace(&conn, "CI Workspace", "ci-ws").expect("Create workspace");
    let proj = create_project(&conn, &ws.id, "Payment Gateway", "PAY", None).expect("Create proj");

    let results = vec![
        IngestCaseResult {
            automation_id: "tests/auth.spec.ts#test-jwt".to_string(),
            title: "JWT Token Generation and Refresh".to_string(),
            suite_path: None,
            tags: None,
            status: "passed".to_string(),
            duration_ms: Some(150),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-success".to_string(),
            title: "Charge card with valid funds".to_string(),
            suite_path: None,
            tags: None,
            status: "passed".to_string(),
            duration_ms: Some(420),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-declined".to_string(),
            title: "Decline card on fraud rule match".to_string(),
            suite_path: None,
            tags: None,
            status: "failed".to_string(),
            duration_ms: Some(310),
            error_message: Some("Expected 402, got 200 OK".to_string()),
            stack_trace: Some("at line 45 charge.spec.ts".to_string()),
            attempt_number: Some(1),
            attachments: None,
        },
    ];

    // 1. First Ingestion: auto-creates 3 test cases
    let input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "ci-run-commit-101".to_string(),
        run_name: "GitHub Actions Build #101".to_string(),
        commit_sha: Some("112233445566".to_string()),
        branch: Some("main".to_string()),
        environment: None,
        auto_create_cases: Some(true),
        results: results.clone(),
        ..Default::default()
    };

    let resp1 = ingest_batch(&mut conn, input).expect("Ingest batch 1");
    assert_eq!(resp1.is_duplicate, false);
    assert_eq!(resp1.ingested_count, 3);
    assert_eq!(resp1.created_cases_count, 3);

    let run1 = get_run(&conn, &resp1.run_id).expect("Get run 1");
    assert_eq!(run1.passed_count, 2);
    assert_eq!(run1.failed_count, 1);
    assert_eq!(run1.status, "completed");

    // 2. Duplicate Ingestion: same idempotency key (e.g. CI network retry)
    let duplicate_input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "ci-run-commit-101".to_string(),
        run_name: "GitHub Actions Build #101 (retry)".to_string(),
        commit_sha: Some("112233445566".to_string()),
        branch: Some("main".to_string()),
        environment: None,
        auto_create_cases: Some(true),
        results: results.clone(),
        ..Default::default()
    };

    let resp_dup = ingest_batch(&mut conn, duplicate_input).expect("Ingest duplicate");
    assert_eq!(resp_dup.is_duplicate, true);
    assert_eq!(resp_dup.run_id, resp1.run_id);
    assert_eq!(resp_dup.ingested_count, 0);
    assert_eq!(resp_dup.created_cases_count, 0);

    // 3. Second commit run: same automation IDs, but new commit & idempotency key
    let results_fixed = vec![
        IngestCaseResult {
            automation_id: "tests/auth.spec.ts#test-jwt".to_string(),
            title: "JWT Token Generation and Refresh".to_string(),
            suite_path: None,
            tags: None,
            status: "passed".to_string(),
            duration_ms: Some(140),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-success".to_string(),
            title: "Charge card with valid funds".to_string(),
            suite_path: None,
            tags: None,
            status: "passed".to_string(),
            duration_ms: Some(390),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-declined".to_string(),
            title: "Decline card on fraud rule match".to_string(),
            suite_path: None,
            tags: None,
            status: "passed".to_string(), // Fixed!
            duration_ms: Some(290),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
    ];

    let input2 = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "ci-run-commit-102".to_string(),
        run_name: "GitHub Actions Build #102".to_string(),
        commit_sha: Some("998877665544".to_string()),
        branch: Some("main".to_string()),
        environment: None,
        auto_create_cases: Some(true),
        results: results_fixed,
        ..Default::default()
    };

    let resp2 = ingest_batch(&mut conn, input2).expect("Ingest batch 2");
    assert_eq!(resp2.is_duplicate, false);
    assert_eq!(resp2.ingested_count, 3);
    assert_eq!(resp2.created_cases_count, 0, "Should reuse existing test cases!");

    let run2 = get_run(&conn, &resp2.run_id).expect("Get run 2");
    assert_eq!(run2.passed_count, 3);
    assert_eq!(run2.failed_count, 0);
    assert_eq!(run2.status, "completed");

    // Total test cases in DB is still 3!
    let total_cases: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM test_cases WHERE project_id = ?1",
            rusqlite::params![proj.id],
            |row| row.get(0),
        )
        .expect("Count test cases");
    assert_eq!(total_cases, 3);
}

#[test]
fn test_ci_ingest_suite_path_hierarchy() {
    let mut conn = setup_test_db();
    let ws = create_workspace(&conn, "Hierarchy WS", "h-ws").expect("Create ws");
    let proj = create_project(&conn, &ws.id, "E2E Platform", "E2E", None).expect("Create proj");

    let results = vec![
        IngestCaseResult {
            automation_id: "tests/checkout.spec.ts#pay".to_string(),
            title: "Submit payment with Visa".to_string(),
            suite_path: Some(vec!["E2E".into(), "Payments".into(), "Checkout".into()]),
            tags: Some(vec!["smoke".into()]),
            status: "passed".to_string(),
            duration_ms: Some(210),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
        IngestCaseResult {
            automation_id: "tests/refund.spec.ts#refund".to_string(),
            title: "Process refund request".to_string(),
            suite_path: Some(vec!["E2E".into(), "Payments".into(), "Refunds".into()]),
            tags: None,
            status: "passed".to_string(),
            duration_ms: Some(190),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        },
    ];

    let input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "hier-run-1".to_string(),
        run_name: "Playwright Suites Run".to_string(),
        commit_sha: None,
        branch: None,
        environment: Some("staging".to_string()),
        auto_create_cases: Some(true),
        results,
        ..Default::default()
    };

    let resp = ingest_batch(&mut conn, input).expect("Ingest batch");
    assert_eq!(resp.created_cases_count, 2);

    // Verify suites in database:
    // "E2E" (root) -> "Payments" (child of E2E) -> "Checkout" and "Refunds" (children of Payments)
    let root_suite_id: String = conn
        .query_row(
            "SELECT id FROM test_suites WHERE project_id = ?1 AND parent_id IS NULL AND title = 'E2E'",
            rusqlite::params![proj.id],
            |row| row.get(0),
        )
        .expect("Root suite exists");

    let payments_suite_id: String = conn
        .query_row(
            "SELECT id FROM test_suites WHERE project_id = ?1 AND parent_id = ?2 AND title = 'Payments'",
            rusqlite::params![proj.id, root_suite_id],
            |row| row.get(0),
        )
        .expect("Payments suite exists");

    let checkout_suite_id: String = conn
        .query_row(
            "SELECT id FROM test_suites WHERE project_id = ?1 AND parent_id = ?2 AND title = 'Checkout'",
            rusqlite::params![proj.id, payments_suite_id],
            |row| row.get(0),
        )
        .expect("Checkout suite exists");

    let refunds_suite_id: String = conn
        .query_row(
            "SELECT id FROM test_suites WHERE project_id = ?1 AND parent_id = ?2 AND title = 'Refunds'",
            rusqlite::params![proj.id, payments_suite_id],
            |row| row.get(0),
        )
        .expect("Refunds suite exists");

    // Verify test cases are linked to their respective leaf suites
    let case1_suite: Option<String> = conn
        .query_row(
            "SELECT suite_id FROM test_cases WHERE project_id = ?1 AND automation_id = 'tests/checkout.spec.ts#pay'",
            rusqlite::params![proj.id],
            |row| row.get(0),
        )
        .expect("Case 1 exists");
    assert_eq!(case1_suite, Some(checkout_suite_id));

    let case2_suite: Option<String> = conn
        .query_row(
            "SELECT suite_id FROM test_cases WHERE project_id = ?1 AND automation_id = 'tests/refund.spec.ts#refund'",
            rusqlite::params![proj.id],
            |row| row.get(0),
        )
        .expect("Case 2 exists");
    assert_eq!(case2_suite, Some(refunds_suite_id));
}

#[test]
fn test_ci_ingest_tag_based_case_matching() {
    let mut conn = setup_test_db();
    let ws = create_workspace(&conn, "Tag WS", "t-ws").expect("Create ws");
    let proj = create_project(&conn, &ws.id, "Core Platform", "LOC", None).expect("Create proj");

    // 1. Pre-create a manual test case in KobeanTest (LOC-5)
    let manual_case = kobean_core::db::create_case(
        &conn,
        kobean_core::db::CreateCaseInput {
            project_id: proj.id.clone(),
            suite_id: None,
            title: "Manual authored checkout flow".to_string(),
            preconditions: Some("User has active cart".to_string()),
            steps_json: None,
            priority: Some("critical".to_string()),
            type_: Some("manual".to_string()),
            automation_id: None,
            tags_json: None,
        },
    )
    .expect("Create manual case");
    assert_eq!(manual_case.case_number, 1);

    // 2. Ingest automated test with tag "@LOC-1" in title
    let results = vec![IngestCaseResult {
        automation_id: "tests/e2e.spec.ts#checkout-tag".to_string(),
        title: "Automated Checkout Flow @LOC-1".to_string(),
        suite_path: Some(vec!["E2E".into(), "Cart".into()]),
        tags: Some(vec!["@LOC-1".into(), "smoke".into()]),
        status: "passed".to_string(),
        duration_ms: Some(350),
        error_message: None,
        stack_trace: None,
        attempt_number: Some(1),
        attachments: None,
    }];

    let input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "tag-run-1".to_string(),
        run_name: "Playwright Tag Run".to_string(),
        commit_sha: None,
        branch: None,
        environment: Some("local".to_string()),
        auto_create_cases: Some(true),
        results,
        ..Default::default()
    };

    let resp = ingest_batch(&mut conn, input).expect("Ingest batch");
    // Should NOT create new case, should link to existing manual case!
    assert_eq!(resp.created_cases_count, 0);
    assert_eq!(resp.ingested_count, 1);

    // Total test cases in DB must still be 1
    let total_cases: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM test_cases WHERE project_id = ?1",
            rusqlite::params![proj.id],
            |row| row.get(0),
        )
        .expect("Count test cases");
    assert_eq!(total_cases, 1);

    // Manual case should have its automation_id populated and suite assigned
    let updated_case = kobean_core::db::get_case(&conn, &manual_case.id).expect("Get case");
    assert_eq!(
        updated_case.automation_id,
        Some("tests/e2e.spec.ts#checkout-tag".to_string())
    );
    assert!(updated_case.suite_id.is_some());
    // Preconditions and priority preserved
    assert_eq!(updated_case.priority, "critical");
    assert_eq!(updated_case.preconditions, Some("User has active cart".to_string()));
}

#[test]
fn test_ci_ingest_attachments() {
    let mut conn = setup_test_db();
    let ws = create_workspace(&conn, "Media WS", "m-ws").expect("Create ws");
    let proj = create_project(&conn, &ws.id, "Media Project", "MED", None).expect("Create proj");

    let tmp_media_dir = tempfile::tempdir().expect("Create temp media dir");

    // 1x1 transparent PNG in base64
    let sample_png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==".to_string();

    let results = vec![IngestCaseResult {
        automation_id: "tests/error.spec.ts#failed-assert".to_string(),
        title: "Button click assertion failed".to_string(),
        suite_path: None,
        tags: None,
        status: "failed".to_string(),
        duration_ms: Some(120),
        error_message: Some("Expected 200 OK but received 500 Internal Error".to_string()),
        stack_trace: Some("Error at line 42".to_string()),
        attempt_number: Some(1),
        attachments: Some(vec![IngestAttachmentInput {
            file_name: "test-failed-1.png".to_string(),
            mime_type: "image/png".to_string(),
            data_base64: sample_png_base64,
            step_number: None,
        }]),
    }];

    let input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "media-run-1".to_string(),
        run_name: "Failure Attachment Run".to_string(),
        commit_sha: None,
        branch: None,
        environment: Some("ci".to_string()),
        auto_create_cases: Some(true),
        results,
        ..Default::default()
    };

    let resp = kobean_core::db::ingest_batch_with_media(&mut conn, input, Some(tmp_media_dir.path()))
        .expect("Ingest batch with media");
    assert_eq!(resp.ingested_count, 1);

    // Verify execution attachment row in DB
    let att_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM execution_attachments", [], |row| row.get(0))
        .expect("Count attachments");
    assert_eq!(att_count, 1);

    let (file_name, file_path, mime_type): (String, String, String) = conn
        .query_row(
            "SELECT file_name, file_path, mime_type FROM execution_attachments LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("Get attachment row");

    assert_eq!(file_name, "test-failed-1.png");
    assert_eq!(mime_type, "image/png");
    assert!(std::path::Path::new(&file_path).exists(), "Saved media file must exist on disk");
}
