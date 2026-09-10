use kobean_core::db::run_migrations;
use kobean_core::server::{dispatch_request, HttpRequest};
use rusqlite::Connection;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

fn send_custom_req(
    db: Arc<Mutex<Connection>>,
    token: &str,
    method: &str,
    path: &str,
    headers: Vec<(&str, &str)>,
    body: Option<&Value>,
) -> (u16, String, Value) {
    let body_bytes = body
        .map(|b| serde_json::to_vec(b).expect("Serialize body"))
        .unwrap_or_default();

    let req_headers = headers
        .into_iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();

    let req = HttpRequest {
        method: method.to_string(),
        path: path.to_string(),
        query: String::new(),
        headers: req_headers,
        body: body_bytes,
    };

    let mut out = Vec::new();
    dispatch_request(&mut out, req, token, db).expect("Dispatch request");

    let response_str = String::from_utf8_lossy(&out).to_string();
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

    (status_code, response_str, json_val)
}

#[test]
fn test_host_header_validation_guards_against_dns_rebinding() {
    let conn = Connection::open_in_memory().expect("Open DB");
    run_migrations(&conn).expect("Run migrations");
    let db = Arc::new(Mutex::new(conn));
    let token = "test-token-security";

    // 1. External malicious Host header -> 400 Bad Request
    let (status, _, body) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/health",
        vec![("Host", "attacker.evil.com")],
        None,
    );
    assert_eq!(status, 400);
    assert!(body["error"].as_str().unwrap().contains("Invalid Host header"));

    // 2. Local loopback Host header -> 200 OK
    let (status, _, body) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/health",
        vec![("Host", "127.0.0.1:4000")],
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(body["status"], "ok");

    // 3. Localhost Host header -> 200 OK
    let (status, _, _) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/health",
        vec![("Host", "localhost:4000")],
        None,
    );
    assert_eq!(status, 200);

    // 4. IPv6 loopback Host header -> 200 OK
    let (status, _, _) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/health",
        vec![("Host", "[::1]:4000")],
        None,
    );
    assert_eq!(status, 200);
}

#[test]
fn test_cross_origin_isolation_and_token_theft_prevention() {
    let temp = tempdir().expect("tempdir");
    std::env::set_var("KOBEAN_HOME", temp.path());

    let conn = Connection::open_in_memory().expect("Open DB");
    run_migrations(&conn).expect("Run migrations");
    let db = Arc::new(Mutex::new(conn));
    let token = "kobean-top-secret-bearer-token";

    // 1. Malicious website trying to fetch /session to steal loopback token -> 403 Forbidden!
    let (status, raw, body) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/session",
        vec![
            ("Host", "127.0.0.1:4000"),
            ("Origin", "https://malicious-website.com"),
        ],
        None,
    );
    assert_eq!(status, 403);
    assert!(body["error"].as_str().unwrap().contains("Cross-origin session access forbidden"));
    assert!(!raw.contains("Access-Control-Allow-Origin: https://malicious-website.com"));
    assert!(!raw.contains("Access-Control-Allow-Origin: *"));

    // 2. Legitimate local origin fetching /session -> 200 OK with token and matching CORS
    let (status, raw, body) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/session",
        vec![
            ("Host", "127.0.0.1:4000"),
            ("Origin", "http://127.0.0.1:4000"),
        ],
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(body["token"], token);
    assert!(raw.contains("Access-Control-Allow-Origin: http://127.0.0.1:4000"));

    // 3. Localhost frontend port (e.g. Vite dev server on 5173) -> 200 OK
    let (status, raw, body) = send_custom_req(
        Arc::clone(&db),
        token,
        "GET",
        "/session",
        vec![
            ("Host", "127.0.0.1:4000"),
            ("Origin", "http://localhost:5173"),
        ],
        None,
    );
    assert_eq!(status, 200);
    assert_eq!(body["token"], token);
    assert!(raw.contains("Access-Control-Allow-Origin: http://localhost:5173"));

    // 4. CORS Preflight OPTIONS from unauthorized origin -> 403 Forbidden
    let (status, raw, _) = send_custom_req(
        Arc::clone(&db),
        token,
        "OPTIONS",
        "/api/v1/workspaces",
        vec![
            ("Host", "127.0.0.1:4000"),
            ("Origin", "https://untrusted-app.net"),
        ],
        None,
    );
    assert_eq!(status, 403);
    assert!(!raw.contains("Access-Control-Allow-Origin: https://untrusted-app.net"));

    // 5. CORS Preflight OPTIONS from loopback origin -> 204 No Content
    let (status, raw, _) = send_custom_req(
        Arc::clone(&db),
        token,
        "OPTIONS",
        "/api/v1/workspaces",
        vec![
            ("Host", "127.0.0.1:4000"),
            ("Origin", "http://127.0.0.1:4000"),
        ],
        None,
    );
    assert_eq!(status, 204);
    assert!(raw.contains("Access-Control-Allow-Origin: http://127.0.0.1:4000"));
}
