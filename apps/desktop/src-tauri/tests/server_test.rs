use kobean_core::db::run_migrations;
use kobean_core::server::{dispatch_request, HttpRequest};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

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

    // 8. CORS OPTIONS preflight -> 204
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
}
