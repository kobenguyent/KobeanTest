use kobean_core::db::{
    create_connection, create_project, create_run, create_suite_full, create_workspace,
    delete_connection, delete_github_account, find_connection_by_repo, get_connection,
    get_github_account, get_run, get_suite, ingest_batch, list_connections, run_migrations,
    save_github_account, update_connection, CreateRunInput, CreateSuiteInput, IngestBatchInput,
    IngestCaseResult,
};
use rusqlite::Connection;

#[test]
fn test_repo_connections_crud_and_linking() {
    let mut conn = Connection::open_in_memory().expect("open in-memory db");
    run_migrations(&conn).expect("run migrations");

    let ws = create_workspace(&conn, "Test WS", "test-ws").expect("create workspace");
    let proj = create_project(&conn, &ws.id, "Platform", "PLAT", None).expect("create project");

    // 1. Create Connection
    let connection = create_connection(
        &conn,
        &proj.id,
        "Core Repo",
        "acme/kobean-platform",
        "https://github.com/acme/kobean-platform",
        Some("main"),
    )
    .expect("create connection");

    assert_eq!(connection.name, "Core Repo");
    assert_eq!(connection.repo_name, "acme/kobean-platform");
    assert_eq!(connection.provider, "github");
    assert_eq!(connection.default_branch, "main");

    // 2. Get and List Connections
    let fetched = get_connection(&conn, &connection.id).expect("get connection");
    assert_eq!(fetched.id, connection.id);

    let list = list_connections(&conn, &proj.id).expect("list connections");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, connection.id);

    // 3. Find by Repo Name
    let found = find_connection_by_repo(&conn, &proj.id, "acme/kobean-platform")
        .expect("find by repo")
        .expect("connection exists");
    assert_eq!(found.id, connection.id);

    // 4. Update Connection
    let updated = update_connection(
        &conn,
        &connection.id,
        "Primary Platform Repo",
        "acme/kobean-platform-updated",
        "https://github.com/acme/kobean-platform-updated",
        Some("develop"),
    )
    .expect("update connection");
    assert_eq!(updated.name, "Primary Platform Repo");
    assert_eq!(updated.repo_name, "acme/kobean-platform-updated");
    assert_eq!(updated.default_branch, "develop");

    // 5. Link Test Suite to Repo Connection
    let suite = create_suite_full(
        &conn,
        CreateSuiteInput {
            project_id: proj.id.clone(),
            title: "Authentication".to_string(),
            description: Some("Auth specs".to_string()),
            position: Some(1),
            repo_connection_id: Some(connection.id.clone()),
            github_repo: Some("acme/kobean-platform-updated".to_string()),
            file_path: Some("tests/e2e/auth.spec.ts".to_string()),
            ..Default::default()
        },
    )
    .expect("create suite full");

    assert_eq!(suite.repo_connection_id, Some(connection.id.clone()));
    assert_eq!(suite.github_repo, Some("acme/kobean-platform-updated".to_string()));
    assert_eq!(suite.file_path, Some("tests/e2e/auth.spec.ts".to_string()));

    let fetched_suite = get_suite(&conn, &suite.id).expect("get suite");
    assert_eq!(fetched_suite.repo_connection_id, Some(connection.id.clone()));

    // 6. Link Test Run to Repo Connection
    let run = create_run(
        &mut conn,
        CreateRunInput {
            project_id: proj.id.clone(),
            title: "Sprint Run".to_string(),
            environment: Some("staging".to_string()),
            source: Some("manual".to_string()),
            idempotency_key: Some("run-conn-test-1".to_string()),
            commit_sha: Some("abc123456789".to_string()),
            branch: Some("feature/auth".to_string()),
            repo_connection_id: Some(connection.id.clone()),
            github_repo: Some("acme/kobean-platform-updated".to_string()),
            pull_request_number: Some(99),
            pull_request_url: Some("https://github.com/acme/kobean-platform-updated/pull/99".to_string()),
            case_ids: vec![],
        },
    )
    .expect("create run");

    assert_eq!(run.repo_connection_id, Some(connection.id.clone()));
    assert_eq!(run.github_repo, Some("acme/kobean-platform-updated".to_string()));
    assert_eq!(run.pull_request_number, Some(99));

    let fetched_run = get_run(&conn, &run.id).expect("get run");
    assert_eq!(fetched_run.repo_connection_id, Some(connection.id.clone()));
    assert_eq!(fetched_run.pull_request_number, Some(99));

    // 7. CI Ingestion Auto-linking to Connection by repo_name
    let ingest_resp = ingest_batch(
        &mut conn,
        IngestBatchInput {
            project_id: proj.id.clone(),
            idempotency_key: "ci-ingest-conn-test".to_string(),
            run_name: "GitHub Actions CI #101".to_string(),
            commit_sha: Some("7f3b89a".to_string()),
            branch: Some("main".to_string()),
            repo_connection_id: None, // Omitted, should be resolved via github_repo
            github_repo: Some("acme/kobean-platform-updated".to_string()),
            pull_request_number: Some(101),
            pull_request_url: Some("https://github.com/acme/kobean-platform-updated/pull/101".to_string()),
            environment: Some("ci".to_string()),
            auto_create_cases: Some(true),
            results: vec![IngestCaseResult {
                automation_id: "tests/billing/checkout.spec.ts#pay".to_string(),
                title: "Checkout Flow @PLAT-1".to_string(),
                suite_path: Some(vec!["E2E".to_string(), "Billing".to_string()]),
                tags: Some(vec!["@PLAT-1".to_string()]),
                status: "passed".to_string(),
                duration_ms: Some(150),
                error_message: None,
                stack_trace: None,
                attempt_number: Some(1),
                attachments: None,
            }],
        },
    )
    .expect("ingest batch");

    assert_eq!(ingest_resp.is_duplicate, false);
    let ci_run = get_run(&conn, &ingest_resp.run_id).expect("get ci run");
    assert_eq!(ci_run.repo_connection_id, Some(connection.id.clone()));
    assert_eq!(ci_run.github_repo, Some("acme/kobean-platform-updated".to_string()));
    assert_eq!(ci_run.pull_request_number, Some(101));

    // 8. Delete Connection (verifies ON DELETE SET NULL on suites and runs)
    delete_connection(&conn, &connection.id).expect("delete connection");
    let after_delete_suite = get_suite(&conn, &suite.id).expect("get suite after delete");
    assert_eq!(after_delete_suite.repo_connection_id, None);
    assert_eq!(after_delete_suite.github_repo, Some("acme/kobean-platform-updated".to_string()));

    let after_delete_run = get_run(&conn, &run.id).expect("get run after delete");
    assert_eq!(after_delete_run.repo_connection_id, None);
    assert_eq!(after_delete_run.github_repo, Some("acme/kobean-platform-updated".to_string()));
}

#[test]
fn test_github_account_authentication_lifecycle() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    run_migrations(&conn).expect("run migrations");

    // Initially no account connected
    let initial = get_github_account(&conn).expect("get account");
    assert!(initial.is_none());

    // Save account
    let saved = save_github_account(
        &conn,
        "octocat",
        Some("The Octocat"),
        Some("https://avatars.githubusercontent.com/u/583231"),
        "ghp_test1234567890abcdef",
    )
    .expect("save github account");

    assert_eq!(saved.login, "octocat");
    assert_eq!(saved.name, Some("The Octocat".to_string()));
    assert_eq!(saved.token_masked, "ghp_te...cdef");

    // Retrieve account
    let fetched = get_github_account(&conn).expect("fetch account").expect("account exists");
    assert_eq!(fetched.id, saved.id);
    assert_eq!(fetched.login, "octocat");

    // Overwrite / re-login
    let updated = save_github_account(
        &conn,
        "newoctocat",
        Some("New Octocat"),
        None,
        "ghp_newtoken12345678",
    )
    .expect("overwrite github account");

    assert_eq!(updated.login, "newoctocat");
    assert_eq!(updated.name, Some("New Octocat".to_string()));
    assert_eq!(updated.avatar_url, None);

    // Verify only 1 account exists
    let fetched_updated = get_github_account(&conn).expect("fetch updated").expect("account exists");
    assert_eq!(fetched_updated.login, "newoctocat");

    // Delete / Disconnect account
    delete_github_account(&conn).expect("delete account");
    let after_delete = get_github_account(&conn).expect("get account after delete");
    assert!(after_delete.is_none());
}
