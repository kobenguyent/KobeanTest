use crate::db::{
    add_attachment, create_case, create_connection, create_project, create_run,
    create_suite_full, create_workspace, delete_case, delete_connection, delete_github_account,
    delete_suite, get_case, get_case_revisions, get_connection, get_github_account, get_project,
    get_run, get_run_items, get_suite, ingest_batch, list_attachments, list_cases,
    list_connections, list_projects, list_runs, list_suites, list_workspaces, record_execution,
    save_github_account, search_cases, seed_starter_data, update_case, update_connection,
    update_suite_full, AddAttachmentInput, CreateCaseInput, CreateRunInput, CreateSuiteInput,
    IngestBatchInput, ListCasesFilter, RecordExecutionInput, UpdateCaseInput, UpdateSuiteInput,
};
use crate::models::Project;
use crate::error::AppError;
use crate::media::{
    get_media_dir, read_media_file, save_media_file, SaveMediaInput, DEFAULT_MAX_QUOTA_BYTES,
};
use crate::session::{get_kobean_dir, validate_token};
use rusqlite::{Connection, OptionalExtension};
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

pub fn is_loopback_host(host: &str) -> bool {
    let host_trim = host.trim();
    let hostname = if let Some(stripped) = host_trim.strip_prefix('[') {
        if let Some((ipv6, _)) = stripped.split_once(']') {
            ipv6
        } else {
            host_trim
        }
    } else if let Some((h, _)) = host_trim.split_once(':') {
        h
    } else {
        host_trim
    };

    hostname.eq_ignore_ascii_case("127.0.0.1")
        || hostname.eq_ignore_ascii_case("localhost")
        || hostname == "::1"
        || hostname.eq_ignore_ascii_case("tauri.localhost")
}

pub fn is_allowed_origin(origin: &str) -> bool {
    let origin_lower = origin.trim().to_lowercase();
    origin_lower.starts_with("http://127.0.0.1:")
        || origin_lower == "http://127.0.0.1"
        || origin_lower.starts_with("http://localhost:")
        || origin_lower == "http://localhost"
        || origin_lower == "tauri://localhost"
        || origin_lower.starts_with("https://tauri.localhost")
        || origin_lower.starts_with("http://tauri.localhost")
}

fn cors_headers_for_req(req: Option<&HttpRequest>) -> String {
    if let Some(req) = req {
        if let Some(origin) = req.get_header("origin") {
            if is_allowed_origin(origin) {
                return format!(
                    "Access-Control-Allow-Origin: {}\r\n\
                     Vary: Origin\r\n\
                     Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
                     Access-Control-Allow-Headers: Authorization, Content-Type, X-Workspace-Id, X-Project-Id\r\n",
                    origin
                );
            }
        }
    }
    String::new()
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
                None => return send_response(&mut stream, 400, "Bad Request", json!({"error": "Empty request"}), None),
            };

            let parts: Vec<&str> = request_line.split_whitespace().collect();
            if parts.len() < 2 {
                return send_response(&mut stream, 400, "Bad Request", json!({"error": "Invalid request line"}), None);
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
    // 1. Validate Host header to prevent DNS rebinding attacks
    if let Some(host) = req.get_header("host") {
        if !is_loopback_host(host) {
            return send_response(
                stream,
                400,
                "Bad Request",
                json!({"error": "Invalid Host header: loopback hostname required"}),
                Some(&req),
            );
        }
    }

    // 2. Handle CORS Preflight
    if req.method == "OPTIONS" {
        return send_cors_options(stream, &req);
    }

    // 3. Health check requires NO auth
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
            Some(&req),
        );
    }

    // Root web UI
    if (req.path == "/" || req.path == "/index.html") && req.method == "GET" {
        let dynamic_html = std::fs::read_to_string("apps/desktop/src-tauri/static/index.html")
            .or_else(|_| std::fs::read_to_string("static/index.html"))
            .or_else(|_| std::fs::read_to_string("src-tauri/static/index.html"));
        let html = match &dynamic_html {
            Ok(content) => content.as_str(),
            Err(_) => include_str!("../static/index.html"),
        };
        return send_raw_response(stream, 200, "OK", "text/html; charset=utf-8", html.as_bytes(), Some(&req));
    }

    // Session discovery for local web UI (guarded against unauthorized external origins)
    if req.path == "/session" && req.method == "GET" {
        if let Some(origin) = req.get_header("origin") {
            if !is_allowed_origin(origin) {
                return send_response(
                    stream,
                    403,
                    "Forbidden",
                    json!({"error": "Cross-origin session access forbidden"}),
                    Some(&req),
                );
            }
        }
        return send_response(
            stream,
            200,
            "OK",
            json!({ "token": expected_token, "status": "ok" }),
            Some(&req),
        );
    }

    // 4. Authenticate Bearer Token for /api/v1/*
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
                Some(&req),
            );
        }
    }

    // 5. Dispatch database routes
    let mut conn = match db.lock() {
        Ok(guard) => guard,
        Err(_) => return send_response(stream, 500, "Internal Server Error", json!({"error": "Database lock poisoned"}), Some(&req)),
    };

    if req.path == "/api/v1/seed" && req.method == "POST" {
        seed_starter_data(&mut conn)?;
        return send_response(stream, 200, "OK", json!({
            "status": "ok",
            "message": "Starter data seeded successfully"
        }), Some(&req));
    }

    if req.path == "/api/v1/workspaces" {
        if req.method == "GET" {
            let list = list_workspaces(&conn)?;
            return send_response(stream, 200, "OK", json!(list), Some(&req));
        } else if req.method == "POST" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let name = body["name"].as_str().unwrap_or("Default Workspace");
            let slug = body["slug"].as_str().unwrap_or("default");
            let ws = create_workspace(&conn, name, slug)?;
            return send_response(stream, 201, "Created", json!(ws), Some(&req));
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
        return send_response(stream, 200, "OK", json!(list), Some(&req));
    }

    if req.path == "/api/v1/projects" {
        if req.method == "GET" {
            let ws_id = if let Some(header_ws) = req.get_header("X-Workspace-Id") {
                Some(header_ws.to_string())
            } else {
                conn.query_row(
                    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()?
            };

            let mut list = if let Some(ref wid) = ws_id {
                list_projects(&conn, wid)?
            } else {
                Vec::new()
            };

            // If empty, return all projects from database or seed default
            if list.is_empty() {
                let all_projects: Vec<Project> = {
                    let mut stmt = conn.prepare(
                        "SELECT id, workspace_id, name, key, description, created_at, updated_at
                         FROM projects ORDER BY created_at ASC",
                    )?;
                    let rows = stmt.query_map([], |row| {
                        Ok(Project {
                            id: row.get(0)?,
                            workspace_id: row.get(1)?,
                            name: row.get(2)?,
                            key: row.get(3)?,
                            description: row.get(4)?,
                            created_at: row.get(5)?,
                            updated_at: row.get(6)?,
                        })
                    })?;
                    rows.filter_map(Result::ok).collect()
                };

                if !all_projects.is_empty() {
                    list = all_projects;
                } else {
                    let _ = seed_starter_data(&mut conn);
                    let mut stmt = conn.prepare(
                        "SELECT id, workspace_id, name, key, description, created_at, updated_at
                         FROM projects ORDER BY created_at ASC",
                    )?;
                    let rows = stmt.query_map([], |row| {
                        Ok(Project {
                            id: row.get(0)?,
                            workspace_id: row.get(1)?,
                            name: row.get(2)?,
                            key: row.get(3)?,
                            description: row.get(4)?,
                            created_at: row.get(5)?,
                            updated_at: row.get(6)?,
                        })
                    })?;
                    list = rows.filter_map(Result::ok).collect();
                }
            }
            return send_response(stream, 200, "OK", json!(list), Some(&req));
        } else if req.method == "POST" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let ws_id = if let Some(wid) = body["workspace_id"].as_str() {
                wid.to_string()
            } else {
                conn.query_row(
                    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()?
                .unwrap_or_else(|| "ws-default".to_string())
            };
            let name = body["name"].as_str().unwrap_or("Untitled Project");
            let key = body["key"].as_str().unwrap_or("PRJ");
            let desc = body["description"].as_str();
            let proj = create_project(&conn, &ws_id, name, key, desc)?;
            return send_response(stream, 201, "Created", json!(proj), Some(&req));
        }
    }

    // Dynamic routes: /api/v1/projects/:project_id/*
    if req.path.starts_with("/api/v1/projects/") {
        let remainder = &req.path["/api/v1/projects/".len()..];
        let segments: Vec<&str> = remainder.split('/').collect();

        if segments.len() == 1 && !segments[0].is_empty() {
            let project_id = segments[0];
            if req.method == "GET" {
                match get_project(&conn, project_id) {
                    Ok(p) => return send_response(stream, 200, "OK", json!(p), Some(&req)),
                    Err(AppError::NotFound(msg)) => {
                        return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req))
                    }
                    Err(e) => return Err(e),
                }
            }
        }

        if segments.len() >= 2 {
            let project_id = segments[0];
            let resource = segments[1];

            if resource == "connections" {
                if req.method == "GET" {
                    let conns = list_connections(&conn, project_id)?;
                    return send_response(stream, 200, "OK", json!(conns), Some(&req));
                } else if req.method == "POST" {
                    let body: Value = serde_json::from_slice(&req.body)?;
                    let name = body["name"].as_str().unwrap_or("GitHub Repository");
                    let repo_name = body["repo_name"].as_str().unwrap_or("");
                    let repo_url = body["repo_url"].as_str().unwrap_or("");
                    let default_branch = body["default_branch"].as_str();
                    let connection = create_connection(&conn, project_id, name, repo_name, repo_url, default_branch)?;
                    return send_response(stream, 201, "Created", json!(connection), Some(&req));
                }
            }

            if resource == "suites" {
                if req.method == "GET" {
                    let suites = list_suites(&conn, project_id)?;
                    return send_response(stream, 200, "OK", json!(suites), Some(&req));
                } else if req.method == "POST" {
                    let body: Value = serde_json::from_slice(&req.body)?;
                    let title = body["title"].as_str().unwrap_or("New Suite");
                    let parent_id = body["parent_id"].as_str();
                    let desc = body["description"].as_str();
                    let pos = body["position"].as_i64();
                    let repo_conn_id = body["repo_connection_id"].as_str();
                    let github_repo = body["github_repo"].as_str();
                    let file_path = body["file_path"].as_str();
                    let suite = create_suite_full(
                        &conn,
                        CreateSuiteInput {
                            project_id: project_id.to_string(),
                            parent_id: parent_id.map(String::from),
                            title: title.to_string(),
                            description: desc.map(String::from),
                            position: pos,
                            repo_connection_id: repo_conn_id.map(String::from),
                            github_repo: github_repo.map(String::from),
                            file_path: file_path.map(String::from),
                        },
                    )?;
                    return send_response(stream, 201, "Created", json!(suite), Some(&req));
                }
            }

            if resource == "cases" {
                if req.method == "GET" {
                    let mut suite_id: Option<String> = None;
                    let mut priority: Option<String> = None;
                    let mut type_: Option<String> = None;
                    let mut is_archived: Option<bool> = Some(false);
                    let mut limit: Option<i64> = Some(100);
                    let mut offset: Option<i64> = None;

                    for param in req.query.split('&') {
                        if let Some((k, v)) = param.split_once('=') {
                            match k {
                                "suite_id" if !v.is_empty() => suite_id = Some(v.to_string()),
                                "priority" if !v.is_empty() => priority = Some(v.to_string()),
                                "type" if !v.is_empty() => type_ = Some(v.to_string()),
                                "is_archived" => is_archived = Some(v == "true" || v == "1"),
                                "limit" => {
                                    if let Ok(val) = v.parse::<i64>() {
                                        limit = Some(val);
                                    }
                                }
                                "offset" => {
                                    if let Ok(val) = v.parse::<i64>() {
                                        offset = Some(val);
                                    }
                                }
                                _ => {}
                            }
                        }
                    }

                    let cases = list_cases(
                        &conn,
                        ListCasesFilter {
                            project_id: project_id.to_string(),
                            suite_id,
                            priority,
                            type_,
                            is_archived,
                            limit,
                            offset,
                        },
                    )?;
                    return send_response(stream, 200, "OK", json!(cases), Some(&req));
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
                    return send_response(stream, 201, "Created", json!(case), Some(&req));
                }
            }

            if resource == "search" && req.method == "GET" {
                let query = if let Some(q) = req.query.split('&').find(|p| p.starts_with("q=")) {
                    &q[2..]
                } else {
                    ""
                };
                let hits = search_cases(&conn, query, 50)?;
                return send_response(stream, 200, "OK", json!(hits), Some(&req));
            }

            if resource == "ci" && segments.len() >= 3 && segments[2] == "ingest" && req.method == "POST" {
                let mut input: IngestBatchInput = serde_json::from_slice(&req.body)?;
                input.project_id = project_id.to_string();
                let resp = ingest_batch(&mut conn, input)?;
                return send_response(stream, 200, "OK", json!(resp), Some(&req));
            }

            if resource == "runs" {
                if req.method == "GET" {
                    let runs = list_runs(&conn, project_id)?;
                    return send_response(stream, 200, "OK", json!(runs), Some(&req));
                } else if req.method == "POST" {
                    let mut input: CreateRunInput = serde_json::from_slice(&req.body)?;
                    input.project_id = project_id.to_string();
                    let run = create_run(&mut conn, input)?;
                    return send_response(stream, 201, "Created", json!(run), Some(&req));
                }
            }
        }
    }

    // Direct Runs collection endpoint
    if req.path == "/api/v1/runs" {
        if req.method == "GET" {
            let runs = if let Some(header_prj) = req.get_header("X-Project-Id") {
                list_runs(&conn, header_prj)?
            } else {
                let first_prj_id: Option<String> = conn
                    .query_row("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1", [], |r| r.get(0))
                    .optional()?;
                if let Some(pid) = first_prj_id {
                    list_runs(&conn, &pid)?
                } else {
                    Vec::new()
                }
            };
            return send_response(stream, 200, "OK", json!(runs), Some(&req));
        } else if req.method == "POST" {
            let mut input: CreateRunInput = serde_json::from_slice(&req.body)?;
            if input.project_id.trim().is_empty() {
                if let Some(header_prj) = req.get_header("X-Project-Id") {
                    input.project_id = header_prj.to_string();
                } else {
                    let first_prj_id: Option<String> = conn
                        .query_row("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1", [], |r| r.get(0))
                        .optional()?;
                    input.project_id = first_prj_id.unwrap_or_else(|| "proj-default".to_string());
                }
            }
            let run = create_run(&mut conn, input)?;
            return send_response(stream, 201, "Created", json!(run), Some(&req));
        }
    }

    // Direct CI Ingestion endpoint
    if req.path == "/api/v1/ci/ingest" && req.method == "POST" {
        let mut input: IngestBatchInput = serde_json::from_slice(&req.body)?;
        if input.project_id.trim().is_empty() {
            if let Some(header_prj) = req.get_header("X-Project-Id") {
                input.project_id = header_prj.to_string();
            } else {
                let first_prj_id: Option<String> = conn
                    .query_row("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1", [], |r| r.get(0))
                    .optional()?;
                input.project_id = first_prj_id.unwrap_or_else(|| "proj-default".to_string());
            }
        }
        let resp = ingest_batch(&mut conn, input)?;
        return send_response(stream, 200, "OK", json!(resp), Some(&req));
    }

    // Standalone Test Case lifecycle routes: /api/v1/cases/:id and /api/v1/cases/:id/revisions
    if req.path.starts_with("/api/v1/cases/") {
        let remainder = &req.path["/api/v1/cases/".len()..];
        if remainder.ends_with("/revisions") && req.method == "GET" {
            let case_id = remainder.strip_suffix("/revisions").unwrap_or(remainder);
            let revs = get_case_revisions(&conn, case_id)?;
            return send_response(stream, 200, "OK", json!(revs), Some(&req));
        }

        let case_id = remainder;
        if req.method == "GET" {
            match get_case(&conn, case_id) {
                Ok(case) => return send_response(stream, 200, "OK", json!(case), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "PUT" {
            let input: UpdateCaseInput = serde_json::from_slice(&req.body)?;
            match update_case(&conn, case_id, input) {
                Ok(case) => return send_response(stream, 200, "OK", json!(case), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "DELETE" {
            match delete_case(&conn, case_id) {
                Ok(()) => return send_response(stream, 200, "OK", json!({"status": "ok", "deleted": true}), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        }
    }

    // Standalone Connection lifecycle routes: /api/v1/connections/:id
    if req.path.starts_with("/api/v1/connections/") {
        let conn_id = &req.path["/api/v1/connections/".len()..];
        if req.method == "GET" {
            match get_connection(&conn, conn_id) {
                Ok(c) => return send_response(stream, 200, "OK", json!(c), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "PUT" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let name = body["name"].as_str().unwrap_or("GitHub Repository");
            let repo_name = body["repo_name"].as_str().unwrap_or("");
            let repo_url = body["repo_url"].as_str().unwrap_or("");
            let default_branch = body["default_branch"].as_str();
            match update_connection(&conn, conn_id, name, repo_name, repo_url, default_branch) {
                Ok(c) => return send_response(stream, 200, "OK", json!(c), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "DELETE" {
            match delete_connection(&conn, conn_id) {
                Ok(()) => return send_response(stream, 200, "OK", json!({"status": "ok", "deleted": true}), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        }
    }

    // GitHub Account Authentication routes: /api/v1/github/account
    if req.path == "/api/v1/github/account" {
        if req.method == "GET" {
            match get_github_account(&conn) {
                Ok(account) => return send_response(stream, 200, "OK", json!(account), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "POST" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let login = body["login"]
                .as_str()
                .ok_or_else(|| AppError::Validation("Missing 'login' field".to_string()))?;
            let name = body["name"].as_str();
            let avatar_url = body["avatar_url"].as_str();
            let token = body["token"]
                .as_str()
                .ok_or_else(|| AppError::Validation("Missing 'token' field".to_string()))?;
            match save_github_account(&conn, login, name, avatar_url, token) {
                Ok(account) => return send_response(stream, 200, "OK", json!(account), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "DELETE" {
            match delete_github_account(&conn) {
                Ok(()) => return send_response(stream, 200, "OK", json!({"status": "ok", "deleted": true}), Some(&req)),
                Err(e) => return Err(e),
            }
        }
    }

    // Standalone Test Suite lifecycle routes: /api/v1/suites/:id
    if req.path.starts_with("/api/v1/suites/") {
        let suite_id = &req.path["/api/v1/suites/".len()..];
        if req.method == "GET" {
            match get_suite(&conn, suite_id) {
                Ok(suite) => return send_response(stream, 200, "OK", json!(suite), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "PUT" {
            let body: Value = serde_json::from_slice(&req.body)?;
            let title = body["title"].as_str().unwrap_or("Updated Suite");
            let desc = body["description"].as_str();
            let parent_id = body["parent_id"].as_str();
            let pos = body["position"].as_i64();
            let repo_conn_id = body["repo_connection_id"].as_str();
            let github_repo = body["github_repo"].as_str();
            let file_path = body["file_path"].as_str();
            match update_suite_full(
                &conn,
                suite_id,
                UpdateSuiteInput {
                    title: title.to_string(),
                    description: desc.map(String::from),
                    parent_id: parent_id.map(String::from),
                    position: pos,
                    repo_connection_id: repo_conn_id.map(String::from),
                    github_repo: github_repo.map(String::from),
                    file_path: file_path.map(String::from),
                },
            ) {
                Ok(suite) => return send_response(stream, 200, "OK", json!(suite), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        } else if req.method == "DELETE" {
            match delete_suite(&conn, suite_id) {
                Ok(()) => return send_response(stream, 200, "OK", json!({"status": "ok", "deleted": true}), Some(&req)),
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        }
    }

    if req.path.starts_with("/api/v1/runs/") {
        let run_id = &req.path["/api/v1/runs/".len()..];
        if req.method == "GET" {
            match get_run(&conn, run_id) {
                Ok(run) => {
                    let items = get_run_items(&conn, run_id)?;
                    return send_response(stream, 200, "OK", json!({ "run": run, "items": items }), Some(&req));
                }
                Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
                Err(e) => return Err(e),
            }
        }
    }

    if req.path.starts_with("/api/v1/run-items/") && req.method == "PUT" {
        let item_id = &req.path["/api/v1/run-items/".len()..];
        let body: Value = serde_json::from_slice(&req.body)?;
        let status = body["status"].as_str().unwrap_or("passed");
        if status == "pending" {
            crate::db::runs::reset_run_item_status(&mut conn, item_id)?;
            return send_response(stream, 200, "OK", json!({ "id": item_id, "status": "pending" }), Some(&req));
        }
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
        return send_response(stream, 200, "OK", json!(exec), Some(&req));
    }

    if req.path == "/api/v1/executions" && req.method == "POST" {
        let input: RecordExecutionInput = serde_json::from_slice(&req.body)?;
        if input.status == "pending" {
            crate::db::runs::reset_run_item_status(&mut conn, &input.run_item_id)?;
            return send_response(stream, 200, "OK", json!({ "run_item_id": input.run_item_id, "status": "pending" }), Some(&req));
        }
        let exec = record_execution(&mut conn, input)?;
        return send_response(stream, 201, "Created", json!(exec), Some(&req));
    }

    if req.path.starts_with("/api/v1/executions/") && req.path.ends_with("/attachments/upload") && req.method == "POST" {
        let remainder = &req.path["/api/v1/executions/".len()..];
        if let Some((exec_id, _)) = remainder.split_once('/') {
            let mut input: SaveMediaInput = serde_json::from_slice(&req.body)?;
            input.execution_id = exec_id.to_string();
            let kobean_dir = get_kobean_dir();
            let media_dir = get_media_dir(&kobean_dir);
            let att = save_media_file(&conn, &media_dir, &input, DEFAULT_MAX_QUOTA_BYTES)?;
            return send_response(stream, 201, "Created", json!(att), Some(&req));
        }
    }

    if req.path.starts_with("/api/v1/executions/") && req.path.ends_with("/attachments") {
        let remainder = &req.path["/api/v1/executions/".len()..];
        if let Some((exec_id, _)) = remainder.split_once('/') {
            if req.method == "GET" {
                let list = list_attachments(&conn, exec_id)?;
                return send_response(stream, 200, "OK", json!(list), Some(&req));
            } else if req.method == "POST" {
                let mut input: AddAttachmentInput = serde_json::from_slice(&req.body)?;
                input.execution_id = exec_id.to_string();
                let att = add_attachment(&conn, input)?;
                return send_response(stream, 201, "Created", json!(att), Some(&req));
            }
        }
    }

    if req.path.starts_with("/api/v1/media/") && req.method == "GET" {
        let filename = &req.path["/api/v1/media/".len()..];
        let kobean_dir = get_kobean_dir();
        let media_dir = get_media_dir(&kobean_dir);
        match read_media_file(&media_dir, filename) {
            Ok((bytes, mime)) => return send_raw_response(stream, 200, "OK", &mime, &bytes, Some(&req)),
            Err(AppError::NotFound(msg)) => return send_response(stream, 404, "Not Found", json!({"error": msg}), Some(&req)),
            Err(e) => return Err(e),
        }
    }

    send_response(stream, 404, "Not Found", json!({"error": "Endpoint not found"}), Some(&req))
}

fn send_raw_response<W: Write>(
    stream: &mut W,
    status_code: u16,
    status_text: &str,
    content_type: &str,
    bytes: &[u8],
    req: Option<&HttpRequest>,
) -> Result<(), AppError> {
    let cors = cors_headers_for_req(req);
    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         {}Connection: close\r\n\r\n",
        status_code,
        status_text,
        content_type,
        bytes.len(),
        cors
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
    req: Option<&HttpRequest>,
) -> Result<(), AppError> {
    let body_bytes = serde_json::to_vec(&body)?;
    let cors = cors_headers_for_req(req);
    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         {}Connection: close\r\n\r\n",
        status_code,
        status_text,
        body_bytes.len(),
        cors
    );

    stream.write_all(response.as_bytes())?;
    stream.write_all(&body_bytes)?;
    stream.flush()?;
    Ok(())
}

fn send_cors_options<W: Write>(stream: &mut W, req: &HttpRequest) -> Result<(), AppError> {
    if let Some(origin) = req.get_header("origin") {
        if !is_allowed_origin(origin) {
            return send_response(
                stream,
                403,
                "Forbidden",
                json!({"error": "Cross-origin request not allowed"}),
                Some(req),
            );
        }
        let response = format!(
            "HTTP/1.1 204 No Content\r\n\
             Access-Control-Allow-Origin: {}\r\n\
             Vary: Origin\r\n\
             Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n\
             Access-Control-Allow-Headers: Authorization, Content-Type, X-Workspace-Id, X-Project-Id\r\n\
             Access-Control-Max-Age: 86400\r\n\
             Connection: close\r\n\r\n",
            origin
        );
        stream.write_all(response.as_bytes())?;
        stream.flush()?;
        return Ok(());
    }

    let response = "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n";
    stream.write_all(response.as_bytes())?;
    stream.flush()?;
    Ok(())
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}
