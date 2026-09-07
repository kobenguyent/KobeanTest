use kobean_core::db::run_migrations;
use kobean_core::server::{dispatch_request, HttpRequest};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

fn run_request(
    db: Arc<Mutex<Connection>>,
    expected_token: &str,
    method: &str,
    path: &str,
    query: &str,
    token: Option<&str>,
    body: Option<&Value>,
) -> (u16, Value) {
    let mut headers = Vec::new();
    if let Some(t) = token {
        headers.push(("Authorization".to_string(), format!("Bearer {t}")));
    }
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
    dispatch_request(&mut out, req, expected_token, db).expect("Dispatch request");

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
fn test_http_server_endpoints_and_security() {
    let temp = tempdir().expect("tempdir");
    std::env::set_var("KOBEAN_HOME", temp.path());

    let conn = Connection::open_in_memory().expect("Open DB");
    run_migrations(&conn).expect("Run migrations");
    let db = Arc::new(Mutex::new(conn));

    let secret_token = "kobean-secret-test-token-xyz123";

    // 1. Health check (no token required)
    let (status, health) = run_request(Arc::clone(&db), secret_token, "GET", "/health", "", None, None);
    assert_eq!(status, 200);
    assert_eq!(health["status"], "ok");
    assert_eq!(health["service"], "kobeantest-localhost-daemon");

    // 2. Secured endpoint with NO token -> 401
    let (status, err) = run_request(Arc::clone(&db), secret_token, "GET", "/api/v1/workspaces", "", None, None);
    assert_eq!(status, 401);
    assert!(err["error"].as_str().unwrap().contains("Unauthorized"));

    // 3. Secured endpoint with INVALID token -> 401
    let (status, _) = run_request(
        Arc::clone(&db),
        secret_token,
        "GET",
        "/api/v1/workspaces",
        "",
        Some("wrong-token"),
        None,
    );
    assert_eq!(status, 401);

    // 4. Create Workspace with VALID token -> 201
    let (status, ws) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        "/api/v1/workspaces",
        "",
        Some(secret_token),
        Some(&json!({"name": "Test Engineering", "slug": "test-eng"})),
    );
    assert_eq!(status, 201);
    let ws_id = ws["id"].as_str().expect("Workspace ID").to_string();

    // 5. Create Project -> 201
    let (status, proj) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        "/api/v1/projects",
        "",
        Some(secret_token),
        Some(&json!({
            "workspace_id": ws_id,
            "name": "Billing Service",
            "key": "BILL",
            "description": "Subscription billing engine"
        })),
    );
    assert_eq!(status, 201);
    let proj_id = proj["id"].as_str().expect("Project ID").to_string();

    // 6. Batch Ingestion via CI Endpoint -> 200
    let (status, ingest_resp) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/ci/ingest"),
        "",
        Some(secret_token),
        Some(&json!({
            "idempotency_key": "ci-http-run-1",
            "run_name": "Nightly Regression Suite",
            "results": [
                {
                    "automation_id": "tests/billing.spec.ts#test-invoice",
                    "title": "Generate monthly invoice PDF",
                    "status": "passed",
                    "duration_ms": 520
                }
            ]
        })),
    );
    assert_eq!(status, 200);
    assert_eq!(ingest_resp["is_duplicate"], false);
    assert_eq!(ingest_resp["ingested_count"], 1);
    assert_eq!(ingest_resp["created_cases_count"], 1);

    // 7. Duplicate Ingestion -> 200 with is_duplicate = true
    let (status, dup_resp) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/ci/ingest"),
        "",
        Some(secret_token),
        Some(&json!({
            "idempotency_key": "ci-http-run-1",
            "run_name": "Nightly Regression Suite (Retry)",
            "results": []
        })),
    );
    assert_eq!(status, 200);
    assert_eq!(dup_resp["is_duplicate"], true);

    // 8. Test Execution and Media Upload
    let cases = kobean_core::db::list_cases(
        &db.lock().expect("Lock DB"),
        kobean_core::db::ListCasesFilter {
            project_id: proj_id.clone(),
            ..Default::default()
        },
    )
    .expect("List cases");
    assert!(!cases.is_empty());

    let (status, run) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        &format!("/api/v1/projects/{proj_id}/runs"),
        "",
        Some(secret_token),
        Some(&json!({
            "title": "Manual Test Run",
            "case_ids": [cases[0].id]
        })),
    );
    assert_eq!(status, 201);
    let run_id = run["id"].as_str().expect("Run ID");

    let (status, run_details) = run_request(
        Arc::clone(&db),
        secret_token,
        "GET",
        &format!("/api/v1/runs/{run_id}"),
        "",
        Some(secret_token),
        None,
    );
    assert_eq!(status, 200);
    let run_item_id = run_details["items"][0]["item"]["id"].as_str().expect("Item ID");

    // Record an execution
    let (status, exec) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        "/api/v1/executions",
        "",
        Some(secret_token),
        Some(&json!({
            "run_item_id": run_item_id,
            "status": "failed",
            "duration_ms": 100,
            "error_message": "Element not visible"
        })),
    );
    assert_eq!(status, 201);
    let exec_id = exec["id"].as_str().expect("Execution ID");

    // Upload attachment via HTTP API
    let (status, att) = run_request(
        Arc::clone(&db),
        secret_token,
        "POST",
        &format!("/api/v1/executions/{exec_id}/attachments/upload"),
        "",
        Some(secret_token),
        Some(&json!({
            "file_name": "screen.png",
            "mime_type": "image/png",
            "data_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        })),
    );
    assert_eq!(status, 201);
    assert_eq!(att["execution_id"], exec_id);
    assert_eq!(att["mime_type"], "image/png");

    // List attachments
    let (status, att_list) = run_request(
        Arc::clone(&db),
        secret_token,
        "GET",
        &format!("/api/v1/executions/{exec_id}/attachments"),
        "",
        Some(secret_token),
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(att_list.as_array().expect("Array").len(), 1);

    // Retrieve media file directly via /api/v1/media/:filename
    let file_path = att["file_path"].as_str().expect("File path");
    let filename = std::path::Path::new(file_path).file_name().expect("Name").to_string_lossy();
    let mut media_out = Vec::new();
    let media_req = HttpRequest {
        method: "GET".to_string(),
        path: format!("/api/v1/media/{filename}"),
        query: format!("token={secret_token}"),
        headers: vec![],
        body: vec![],
    };
    dispatch_request(&mut media_out, media_req, secret_token, Arc::clone(&db)).expect("Dispatch media get");
    let media_resp = String::from_utf8_lossy(&media_out);
    assert!(media_resp.starts_with("HTTP/1.1 200 OK"));
    assert!(media_resp.contains("Content-Type: image/png"));

    // 9. CORS OPTIONS preflight -> 204
    let mut cors_out = Vec::new();
    let cors_req = HttpRequest {
        method: "OPTIONS".to_string(),
        path: "/api/v1/projects".to_string(),
        query: "".to_string(),
        headers: vec![],
        body: vec![],
    };
    dispatch_request(&mut cors_out, cors_req, secret_token, Arc::clone(&db)).expect("Dispatch options");
    let options_str = String::from_utf8_lossy(&cors_out);
    assert!(options_str.starts_with("HTTP/1.1 204 No Content"));

    // 10. Root Web Console HTML -> 200 OK
    let mut html_out = Vec::new();
    let html_req = HttpRequest {
        method: "GET".to_string(),
        path: "/".to_string(),
        query: "".to_string(),
        headers: vec![],
        body: vec![],
    };
    dispatch_request(&mut html_out, html_req, secret_token, Arc::clone(&db)).expect("Dispatch html get");
    let html_resp = String::from_utf8_lossy(&html_out);
    assert!(html_resp.starts_with("HTTP/1.1 200 OK"));
    assert!(html_resp.contains("Content-Type: text/html"));
    assert!(html_resp.contains("KobeanTest"));

    // 11. Loopback Session Token Discovery -> 200 OK
    let (status, sess) = run_request(Arc::clone(&db), secret_token, "GET", "/session", "", None, None);
    assert_eq!(status, 200);
    assert_eq!(sess["token"], secret_token);
}
