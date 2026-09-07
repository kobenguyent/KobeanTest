use kobean_core::db::{
    create_project, create_workspace, get_run, ingest_batch, run_migrations,
    IngestBatchInput, IngestCaseResult,
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
            status: "passed".to_string(),
            duration_ms: Some(150),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-success".to_string(),
            title: "Charge card with valid funds".to_string(),
            status: "passed".to_string(),
            duration_ms: Some(420),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-declined".to_string(),
            title: "Decline card on fraud rule match".to_string(),
            status: "failed".to_string(),
            duration_ms: Some(310),
            error_message: Some("Expected 402, got 200 OK".to_string()),
            stack_trace: Some("at line 45 charge.spec.ts".to_string()),
            attempt_number: Some(1),
        },
    ];

    // 1. First Ingestion: auto-creates 3 test cases
    let input = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "ci-run-commit-101".to_string(),
        run_name: "GitHub Actions Build #101".to_string(),
        commit_sha: Some("112233445566".to_string()),
        branch: Some("main".to_string()),
        auto_create_cases: Some(true),
        results: results.clone(),
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
        auto_create_cases: Some(true),
        results: results.clone(),
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
            status: "passed".to_string(),
            duration_ms: Some(140),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-success".to_string(),
            title: "Charge card with valid funds".to_string(),
            status: "passed".to_string(),
            duration_ms: Some(390),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
        },
        IngestCaseResult {
            automation_id: "tests/charge.spec.ts#test-charge-declined".to_string(),
            title: "Decline card on fraud rule match".to_string(),
            status: "passed".to_string(), // Fixed!
            duration_ms: Some(290),
            error_message: None,
            stack_trace: None,
            attempt_number: Some(1),
        },
    ];

    let input2 = IngestBatchInput {
        project_id: proj.id.clone(),
        idempotency_key: "ci-run-commit-102".to_string(),
        run_name: "GitHub Actions Build #102".to_string(),
        commit_sha: Some("998877665544".to_string()),
        branch: Some("main".to_string()),
        auto_create_cases: Some(true),
        results: results_fixed,
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
