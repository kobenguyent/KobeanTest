use crate::db::{
    add_attachment, create_case, create_project, create_run, create_suite, create_workspace,
    get_run, get_run_items, ingest_batch, list_attachments, list_cases, list_projects,
    list_runs, list_suites, list_workspaces, record_execution, search_cases, seed_starter_data,
    AddAttachmentInput, CreateCaseInput, CreateRunInput, IngestBatchInput, ListCasesFilter,
    RecordExecutionInput,
};
use crate::error::AppError;
use crate::media::{
    get_media_dir, read_media_file, save_media_file, SaveMediaInput, DEFAULT_MAX_QUOTA_BYTES,
};
use crate::session::{get_kobean_dir, validate_token};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct HttpServer {
    pub port: u16,
    pub token: String,
    db: Arc<Mutex<Connection>>,
    shutdown: Arc<Mutex<bool>>,
}

pub struct HttpRequest {
    pub method: String,
    pub path: String,
    pub query: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl HttpRequest {
    pub fn get_header(&self, name: &str) -> Option<&str> {
        let name_lower = name.to_lowercase();
        for (k, v) in &self.headers {
            if k.to_lowercase() == name_lower {
                return Some(v.as_str());
            }
        }
        None
    }
}

impl HttpServer {
    pub fn new(port: u16, token: String, db: Arc<Mutex<Connection>>) -> Self {
        Self {
            port,
            token,
            db,
            shutdown: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&self) -> Result<(u16, Arc<Mutex<bool>>), AppError> {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", self.port))?;
        let actual_port = listener.local_addr()?.port();
        listener.set_nonblocking(true)?;

        let token = self.token.clone();
        let db = Arc::clone(&self.db);
        let shutdown = Arc::clone(&self.shutdown);
        let shutdown_loop = Arc::clone(&self.shutdown);

        thread::spawn(move || {
            while let Ok(guard) = shutdown_loop.lock() {
                if *guard {
                    break;
                }
                drop(guard);

                match listener.accept() {
                    Ok((stream, _)) => {
                        let token_clone = token.clone();
                        let db_clone = Arc::clone(&db);
                        thread::spawn(move || {
                            let _ = handle_client(stream, &token_clone, db_clone);
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(std::time::Duration::from_millis(10));
                    }
                    Err(_) => break,
                }
            }
        });

        Ok((actual_port, shutdown))
    }
}

fn handle_client(
    mut stream: TcpStream,
    expected_token: &str,
    db: Arc<Mutex<Connection>>,
) -> Result<(), AppError> {
    let mut buffer = [0u8; 8192];
    let mut received = Vec::new();

    loop {
        let bytes_read = match stream.read(&mut buffer) {
            Ok(0) => return Ok(()),
            Ok(n) => n,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(std::time::Duration::from_millis(5));
                continue;
            }
            Err(e) => return Err(AppError::Io(e)),
        };

        received.extend_from_slice(&buffer[..bytes_read]);

        if let Some(pos) = find_subsequence(&received, b"\r\n\r\n") {
            let header_bytes = &received[..pos];
            let header_str = String::from_utf8_lossy(header_bytes);
            let mut lines = header_str.lines();

            let request_line = match lines.next() {
                Some(line) => line,
                None => return send_response(&mut stream, 400, "Bad Request", json!({"error": "Empty request"})),
            };

            let parts: Vec<&str> = request_line.split_whitespace().collect();
            if parts.len() < 2 {
                return send_response(&mut stream, 400, "Bad Request", json!({"error": "Invalid request line"}));
            }

            let method = parts[0].to_string();
            let full_url = parts[1].to_string();
            let (path, query) = match full_url.split_once('?') {
                Some((p, q)) => (p.to_string(), q.to_string()),
                None => (full_url, String::new()),
            };

            let mut headers = Vec::new();
            let mut content_length = 0usize;

            for line in lines {
                if let Some((k, v)) = line.split_once(':') {
                    let key = k.trim().to_string();
                    let val = v.trim().to_string();
                    if key.eq_ignore_ascii_case("content-length") {
                        if let Ok(len) = val.parse::<usize>() {
                            content_length = len;
                        }
                    }
                    headers.push((key, val));
                }
            }

            let body_start = pos + 4;
            let mut body = received[body_start..].to_vec();

            while body.len() < content_length {
                let n = stream.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                body.extend_from_slice(&buffer[..n]);
            }

            let req = HttpRequest {
                method,
                path,
                query,
                headers,
                body,
            };

            return dispatch_request(&mut stream, req, expected_token, db);
        }
    }
}

pub fn dispatch_request<W: Write>(
    stream: &mut W,
    req: HttpRequest,
    expected_token: &str,
    db: Arc<Mutex<Connection>>,
) -> Result<(), AppError> {

    // 1. Handle CORS Preflight
    if req.method == "OPTIONS" {
        return send_cors_options(stream);
    }

    // 2. Health check requires NO auth
    if req.path == "/health" && req.method == "GET" {
        return send_response(
            stream,
            200,
            "OK",
            json!({
                "status": "ok",
                "version": "0.1.0",
                "service": "kobeantest-localhost-daemon"
            }),
        );
    }

    // Root web UI
    if (req.path == "/" || req.path == "/index.html") && req.method == "GET" {
        let html = include_str!("../static/index.html");
        return send_raw_response(stream, 200, "OK", "text/html; charset=utf-8", html.as_bytes());
    }

    // Session discovery for local web UI
    if req.path == "/session" && req.method == "GET" {
        return send_response(
            stream,
            200,
            "OK",
            json!({ "token": expected_token, "status": "ok" }),
        );
    }

    // 3. Authenticate Bearer Token for /api/v1/*
    if req.path.starts_with("/api/v1") {
        let auth_header = req.get_header("Authorization").unwrap_or("");
        let mut token = if let Some(stripped) = auth_header.strip_prefix("Bearer ") {
            stripped.trim()
        } else {
            ""
        };

        // For media assets (e.g. <img> tags), permit query param token ?token=...
        if token.is_empty() && req.path.starts_with("/api/v1/media/") {
            if let Some(q_tok) = req.query.split('&').find(|p| p.starts_with("token=")) {
                token = &q_tok["token=".len()..];
            }
        }

        if !validate_token(expected_token, token) {
            return send_response(
                stream,
                401,
                "Unauthorized",
                json!({"error": "Unauthorized: valid loopback bearer token required"}),
            );
        }
    }

    // 4. Dispatch routes
    let mut conn = match db.lock() {
        Ok(guard) => guard,
        Err(_) => return send_response(stream, 500, "Internal Server Error", json!({"error": "Database lock poisoned"})),
    };

    if req.path == "/api/v1/seed" && req.method == "POST" {
        seed_starter_data(&mut conn)?;
        return send_response(stream, 200, "OK", json!({
            "status": "ok",
            "message": "Starter data seeded successfully"
        }));
    }

    if req.path == "/api/v1/workspaces" {
        if req.method == "GET" {
            let list = list_workspaces(&conn)?;
            return send_response(stream, 200, "OK", json!(list));
        } else if req.method == "POST" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let name = body["name"].as_str().unwrap_or("Default Workspace");
            let slug = body["slug"].as_str().unwrap_or("default");
            let ws = create_workspace(&conn, name, slug)?;
            return send_response(stream, 201, "Created", json!(ws));
        }
    }

    if req.path.starts_with("/api/v1/workspaces/") && req.path.ends_with("/projects") && req.method == "GET" {
        let ws_id = req.path.strip_prefix("/api/v1/workspaces/")
            .unwrap_or("")
            .strip_suffix("/projects")
            .unwrap_or("ws-default");
        let mut list = list_projects(&conn, ws_id)?;
        if list.is_empty() {
            let _ = seed_starter_data(&mut conn);
            list = list_projects(&conn, ws_id)?;
        }
        return send_response(stream, 200, "OK", json!(list));
    }

    if req.path == "/api/v1/projects" {
        if req.method == "GET" {
            let ws_id = req.get_header("X-Workspace-Id").unwrap_or("ws-default");
            let mut list = list_projects(&conn, ws_id)?;
            if list.is_empty() {
                let _ = seed_starter_data(&mut conn);
                list = list_projects(&conn, ws_id)?;
            }
            return send_response(stream, 200, "OK", json!(list));
        } else if req.method == "POST" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let ws_id = body["workspace_id"].as_str().unwrap_or("ws-default");
            let name = body["name"].as_str().unwrap_or("Untitled Project");
            let key = body["key"].as_str().unwrap_or("PRJ");
            let desc = body["description"].as_str();
            let proj = create_project(&conn, ws_id, name, key, desc)?;
            return send_response(stream, 201, "Created", json!(proj));
        }
    }

    // Dynamic routes: /api/v1/projects/:project_id/suites
    if req.path.starts_with("/api/v1/projects/") {
        let remainder = &req.path["/api/v1/projects/".len()..];
        let segments: Vec<&str> = remainder.split('/').collect();

        if segments.len() >= 2 {
            let project_id = segments[0];
            let resource = segments[1];

            if resource == "suites" {
                if req.method == "GET" {
                    let suites = list_suites(&conn, project_id)?;
                    return send_response(stream, 200, "OK", json!(suites));
                } else if req.method == "POST" {
                    let body: Value = serde_json::from_slice(&req.body)?;
                    let title = body["title"].as_str().unwrap_or("New Suite");
                    let parent_id = body["parent_id"].as_str();
                    let desc = body["description"].as_str();
                    let pos = body["position"].as_i64();
                    let suite = create_suite(&conn, project_id, parent_id, title, desc, pos)?;
                    return send_response(stream, 201, "Created", json!(suite));
                }
            }

            if resource == "cases" {
                if req.method == "GET" {
                    let cases = list_cases(
                        &conn,
                        ListCasesFilter {
                            project_id: project_id.to_string(),
                            suite_id: None,
                            priority: None,
                            type_: None,
                            is_archived: Some(false),
                            limit: Some(100),
                            offset: None,
                        },
                    )?;
                    return send_response(stream, 200, "OK", json!(cases));
                } else if req.method == "POST" {
                    let body: Value = serde_json::from_slice(&req.body)?;
                    let title = body["title"].as_str().unwrap_or("New Case");
                    let suite_id = body["suite_id"].as_str().map(|s| s.to_string());
                    let priority = body["priority"].as_str().map(|s| s.to_string());
                    let type_ = body["type"].as_str().map(|s| s.to_string());
                    let steps_json = body["steps_json"].as_str().map(|s| s.to_string());
                    let automation_id = body["automation_id"].as_str().map(|s| s.to_string());

                    let case = create_case(
                        &conn,
                        CreateCaseInput {
                            project_id: project_id.to_string(),
                            suite_id,
                            title: title.to_string(),
                            preconditions: None,
                            steps_json,
                            priority,
                            type_,
                            automation_id,
                            tags_json: None,
                        },
                    )?;
                    return send_response(stream, 201, "Created", json!(case));
                }
            }

            if resource == "search" && req.method == "GET" {
                let query = if let Some(q) = req.query.split('&').find(|p| p.starts_with("q=")) {
                    &q[2..]
                } else {
                    ""
                };
                let hits = search_cases(&conn, query, 50)?;
                return send_response(stream, 200, "OK", json!(hits));
            }

            if resource == "ci" && segments.len() >= 3 && segments[2] == "ingest" && req.method == "POST" {
                let mut input: IngestBatchInput = serde_json::from_slice(&req.body)?;
                input.project_id = project_id.to_string();
                let resp = ingest_batch(&mut conn, input)?;
                return send_response(stream, 200, "OK", json!(resp));
            }

            if resource == "runs" {
                if req.method == "GET" {
                    let runs = list_runs(&conn, project_id)?;
                    return send_response(stream, 200, "OK", json!(runs));
                } else if req.method == "POST" {
                    let mut input: CreateRunInput = serde_json::from_slice(&req.body)?;
                    input.project_id = project_id.to_string();
                    let run = create_run(&mut conn, input)?;
                    return send_response(stream, 201, "Created", json!(run));
                }
            }
        }
    }

    if req.path.starts_with("/api/v1/runs/") {
        let run_id = &req.path["/api/v1/runs/".len()..];
        if req.method == "GET" {
            let run = get_run(&conn, run_id)?;
            let items = get_run_items(&conn, run_id)?;
            return send_response(stream, 200, "OK", json!({ "run": run, "items": items }));
        }
    }

    if req.path.starts_with("/api/v1/run-items/") && req.method == "PUT" {
        let item_id = &req.path["/api/v1/run-items/".len()..];
        let body: Value = serde_json::from_slice(&req.body)?;
        let status = body["status"].as_str().unwrap_or("passed");
        let notes = body["notes"].as_str().map(|s| s.to_string());
        let duration_ms = body["duration_ms"].as_i64();
        let exec = record_execution(
            &mut conn,
            RecordExecutionInput {
                run_item_id: item_id.to_string(),
                status: status.to_string(),
                duration_ms,
                error_message: None,
                stack_trace: None,
                notes,
                executed_by: Some("Tester".to_string()),
                step_results: None,
            },
        )?;
        return send_response(stream, 200, "OK", json!(exec));
    }

    if req.path == "/api/v1/executions" && req.method == "POST" {
        let input: RecordExecutionInput = serde_json::from_slice(&req.body)?;
        let exec = record_execution(&mut conn, input)?;
        return send_response(stream, 201, "Created", json!(exec));
    }

    if req.path.starts_with("/api/v1/executions/") && req.path.ends_with("/attachments/upload") && req.method == "POST" {
        let remainder = &req.path["/api/v1/executions/".len()..];
        if let Some((exec_id, _)) = remainder.split_once('/') {
            let mut input: SaveMediaInput = serde_json::from_slice(&req.body)?;
            input.execution_id = exec_id.to_string();
            let kobean_dir = get_kobean_dir();
            let media_dir = get_media_dir(&kobean_dir);
            let att = save_media_file(&conn, &media_dir, &input, DEFAULT_MAX_QUOTA_BYTES)?;
            return send_response(stream, 201, "Created", json!(att));
        }
    }

    if req.path.starts_with("/api/v1/executions/") && req.path.ends_with("/attachments") {
        let remainder = &req.path["/api/v1/executions/".len()..];
        if let Some((exec_id, _)) = remainder.split_once('/') {
            if req.method == "GET" {
                let list = list_attachments(&conn, exec_id)?;
                return send_response(stream, 200, "OK", json!(list));
            } else if req.method == "POST" {
                let mut input: AddAttachmentInput = serde_json::from_slice(&req.body)?;
                input.execution_id = exec_id.to_string();
                let att = add_attachment(&conn, input)?;
                return send_response(stream, 201, "Created", json!(att));
            }
        }
    }

    if req.path.starts_with("/api/v1/media/") && req.method == "GET" {
        let filename = &req.path["/api/v1/media/".len()..];
        let kobean_dir = get_kobean_dir();
        let media_dir = get_media_dir(&kobean_dir);
        let (bytes, mime) = read_media_file(&media_dir, filename)?;
        return send_raw_response(stream, 200, "OK", &mime, &bytes);
    }

    send_response(stream, 404, "Not Found", json!({"error": "Endpoint not found"}))
}

fn send_raw_response<W: Write>(
    stream: &mut W,
    status_code: u16,
    status_text: &str,
    content_type: &str,
    bytes: &[u8],
) -> Result<(), AppError> {
    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, OPTIONS\r\n\
         Access-Control-Allow-Headers: Authorization, Content-Type\r\n\
         Connection: close\r\n\r\n",
        status_code,
        status_text,
        content_type,
        bytes.len()
    );

    stream.write_all(response.as_bytes())?;
    stream.write_all(bytes)?;
    stream.flush()?;
    Ok(())
}

fn send_response<W: Write>(
    stream: &mut W,
    status_code: u16,
    status_text: &str,
    body: Value,
) -> Result<(), AppError> {
    let body_bytes = serde_json::to_vec(&body)?;
    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
         Access-Control-Allow-Headers: Authorization, Content-Type\r\n\
         Connection: close\r\n\r\n",
        status_code,
        status_text,
        body_bytes.len()
    );

    stream.write_all(response.as_bytes())?;
    stream.write_all(&body_bytes)?;
    stream.flush()?;
    Ok(())
}

fn send_cors_options<W: Write>(stream: &mut W) -> Result<(), AppError> {
    let response = "HTTP/1.1 204 No Content\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
         Access-Control-Allow-Headers: Authorization, Content-Type\r\n\
         Access-Control-Max-Age: 86400\r\n\
         Connection: close\r\n\r\n";
    stream.write_all(response.as_bytes())?;
    stream.flush()?;
    Ok(())
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}
