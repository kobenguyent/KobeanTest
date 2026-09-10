use kobean_core::db::run_migrations;
use kobean_core::server::{dispatch_request, HttpRequest};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

fn test_req(
    db: Arc<Mutex<Connection>>,
    token: &str,
    method: &str,
    path: &str,
    query: &str,
    body: Option<&Value>,
) -> (u16, Value) {
    let headers = vec![
        ("Authorization".to_string(), format!("Bearer {token}")),
        ("Host".to_string(), "127.0.0.1:4000".to_string()),
    ];
    let body_bytes = body
        .map(|b| serde_json::to_vec(b).expect("Serialize body"))
        .unwrap_or_default();

    let req = HttpRequest {
        method: method.to_string(),
        path: path.to_string(),
        query: query.to_string(),
        headers,
        body: body_bytes,
    };

    let mut out = Vec::new();
    dispatch_request(&mut out, req, token, db).expect("Dispatch request");

    let response_str = String::from_utf8_lossy(&out);
    let mut lines = response_str.lines();
    let status_line = lines.next().expect("Status line");
    let status_code: u16 = status_line
        .split_whitespace()
        .nth(1)
        .expect("Status code")
        .parse()
        .expect("Parse code");

    let body_part = response_str.split("\r\n\r\n").nth(1).unwrap_or("");
    let json_val: Value = serde_json::from_str(body_part).unwrap_or(Value::Null);

    (status_code, json_val)
}

#[test]
fn test_case_and_suite_lifecycle_api() {
    let temp = tempdir().expect("tempdir");
    std::env::set_var("KOBEAN_HOME", temp.path());

    let conn = Connection::open_in_memory().expect("Open DB");
    run_migrations(&conn).expect("Run migrations");
    let db = Arc::new(Mutex::new(conn));
    let token = "test-token-cases-suites";

    // Setup project and suite
    let (status, ws) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        "/api/v1/workspaces",
        "",
        Some(&json!({"name": "Lifecycle WS", "slug": "lifecycle-ws"})),
    );
    assert_eq!(status, 201);
    let ws_id = ws["id"].as_str().expect("WS ID");

    let (status, proj) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        "/api/v1/projects",
        "",
        Some(&json!({"workspace_id": ws_id, "name": "Core Project", "key": "CORE"})),
    );
    assert_eq!(status, 201);
    let proj_id = proj["id"].as_str().expect("Project ID");

    let (status, suite) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/suites"),
        "",
        Some(&json!({"title": "Initial Suite", "description": "Suite 1"})),
    );
    assert_eq!(status, 201);
    let suite_id = suite["id"].as_str().expect("Suite ID");

    // 1. Create Case
    let (status, case) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/cases"),
        "",
        Some(&json!({
            "suite_id": suite_id,
            "title": "Case to be edited",
            "priority": "medium",
            "type": "manual",
            "steps_json": "[{\"step_number\":1,\"action\":\"Click button\",\"expected\":\"Navigates\"}]"
        })),
    );
    assert_eq!(status, 201);
    let case_id = case["id"].as_str().expect("Case ID");
    assert_eq!(case["version"], 1);

    // 2. Fetch single case via GET /api/v1/cases/:id
    let (status, fetched_case) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/cases/{case_id}"),
        "",
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(fetched_case["title"], "Case to be edited");

    // 3. Update Case via PUT /api/v1/cases/:id (bumping version to 2)
    let (status, updated_case) = test_req(
        Arc::clone(&db),
        token,
        "PUT",
        &format!("/api/v1/cases/{case_id}"),
        "",
        Some(&json!({
            "title": "Case title updated by UI",
            "priority": "critical",
            "type": "automated",
            "preconditions": "User logged in",
            "steps_json": "[{\"step_number\":1,\"action\":\"New action\",\"expected\":\"New expectation\"}]"
        })),
    );
    assert_eq!(status, 200);
    assert_eq!(updated_case["title"], "Case title updated by UI");
    assert_eq!(updated_case["priority"], "critical");
    assert_eq!(updated_case["version"], 2);

    // 4. Query Revisions via GET /api/v1/cases/:id/revisions
    let (status, revs) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/cases/{case_id}/revisions"),
        "",
        None,
    );
    assert_eq!(status, 200);
    let revs_arr = revs.as_array().expect("Revisions array");
    assert_eq!(revs_arr.len(), 2, "Must have revisions for v1 and v2");
    assert_eq!(revs_arr[0]["version"], 2);
    assert_eq!(revs_arr[1]["version"], 1);

    // 5. Suite Filtering via GET /api/v1/projects/:id/cases?suite_id=...
    let (status, filtered_cases) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/projects/{proj_id}/cases"),
        &format!("suite_id={suite_id}"),
        None,
    );
    assert_eq!(status, 200);
    let list = filtered_cases.as_array().expect("Cases array");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["id"], case_id);

    // Filter for non-existent suite returns empty list
    let (status, empty_cases) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/projects/{proj_id}/cases"),
        "suite_id=non-existent-suite",
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(empty_cases.as_array().expect("Cases array").len(), 0);

    // 6. Update Suite via PUT /api/v1/suites/:id
    let (status, updated_suite) = test_req(
        Arc::clone(&db),
        token,
        "PUT",
        &format!("/api/v1/suites/{suite_id}"),
        "",
        Some(&json!({"title": "Renamed Suite", "description": "Updated description"})),
    );
    assert_eq!(status, 200);
    assert_eq!(updated_suite["title"], "Renamed Suite");

    // 7. Universal Direct CI Ingest via POST /api/v1/ci/ingest
    let (status, ingest_resp) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        "/api/v1/ci/ingest",
        "",
        Some(&json!({
            "project_id": proj_id,
            "idempotency_key": "ci-direct-ingest-key-1",
            "run_name": "Direct Ingest Run",
            "results": [
                {
                    "automation_id": "tests/direct.spec.ts",
                    "title": "Directly ingested test",
                    "status": "passed",
                    "duration_ms": 250
                }
            ]
        })),
    );
    assert_eq!(status, 200);
    assert_eq!(ingest_resp["ingested_count"], 1);
    assert_eq!(ingest_resp["created_cases_count"], 1);

    // 8. Delete Case via DELETE /api/v1/cases/:id
    let (status, del_resp) = test_req(
        Arc::clone(&db),
        token,
        "DELETE",
        &format!("/api/v1/cases/{case_id}"),
        "",
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(del_resp["deleted"], true);

    // Case is now deleted -> 404
    let (status, _) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/cases/{case_id}"),
        "",
        None,
    );
    assert_eq!(status, 404);

    // 9. Delete Suite via DELETE /api/v1/suites/:id
    let (status, del_suite_resp) = test_req(
        Arc::clone(&db),
        token,
        "DELETE",
        &format!("/api/v1/suites/{suite_id}"),
        "",
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(del_suite_resp["deleted"], true);
}

#[test]
fn test_project_fallback_and_run_creation_lifecycle() {
    let temp = tempdir().expect("tempdir");
    std::env::set_var("KOBEAN_HOME", temp.path());

    let conn = Connection::open_in_memory().expect("Open DB");
    run_migrations(&conn).expect("Run migrations");
    let db = Arc::new(Mutex::new(conn));
    let token = "test-token-runs";

    // 1. Create a workspace with a random UUID
    let (status, ws) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        "/api/v1/workspaces",
        "",
        Some(&json!({"name": "Custom WS", "slug": "custom-ws"})),
    );
    assert_eq!(status, 201);
    let ws_id = ws["id"].as_str().expect("WS ID");

    // 2. Create a project under this workspace
    let (status, proj) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        "/api/v1/projects",
        "",
        Some(&json!({
            "workspace_id": ws_id,
            "name": "E2E Platform",
            "key": "E2E"
        })),
    );
    assert_eq!(status, 201);
    let proj_id = proj["id"].as_str().expect("Project ID");

    // 3. Verify GET /api/v1/projects WITHOUT X-Workspace-Id header returns the project!
    let (status, projs_resp) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        "/api/v1/projects",
        "",
        None,
    );
    assert_eq!(status, 200);
    assert!(projs_resp.as_array().expect("array").len() >= 1);
    assert_eq!(projs_resp[0]["name"], "E2E Platform");

    // 4. Create 2 test cases in the project
    let (status, _case1) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/cases"),
        "",
        Some(&json!({
            "title": "Case One",
            "priority": "high",
            "type": "automated"
        })),
    );
    assert_eq!(status, 201);

    let (status, _case2) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/cases"),
        "",
        Some(&json!({
            "title": "Case Two",
            "priority": "critical",
            "type": "manual"
        })),
    );
    assert_eq!(status, 201);

    // 5. Create a test run with NO case_ids specified (should auto-pull active test cases!)
    let (status, run_resp) = test_req(
        Arc::clone(&db),
        token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/runs"),
        "",
        Some(&json!({
            "title": "Sprint 1 Regression",
            "environment": "Localhost"
        })),
    );
    assert_eq!(status, 201);
    assert_eq!(run_resp["title"], "Sprint 1 Regression");
    assert_eq!(run_resp["total_count"], 2);
    let run_id = run_resp["id"].as_str().expect("run id");

    // 6. Fetch run details via /api/v1/runs/:id
    let (status, details) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        &format!("/api/v1/runs/{run_id}"),
        "",
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(details["items"].as_array().expect("items").len(), 2);

    // 7. Direct /api/v1/runs collection endpoint
    let (status, all_runs) = test_req(
        Arc::clone(&db),
        token,
        "GET",
        "/api/v1/runs",
        "",
        None,
    );
    assert_eq!(status, 200);
    assert!(all_runs.as_array().expect("runs array").len() >= 1);
}

