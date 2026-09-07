#![deny(clippy::unwrap_used, clippy::expect_used)]

use kobean_core::db::{run_migrations, verify_backup_integrity};
use kobean_core::server::HttpServer;
use kobean_core::session::{create_session, get_kobean_dir, read_session};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

fn main() {
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("  KobeanTest — 100% Localhost Test Management Daemon");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let kobean_dir = get_kobean_dir();
    let port = 4000u16;

    // 1. Session Setup
    let session = match read_session(&kobean_dir) {
        Ok(s) => s,
        Err(_) => match create_session(&kobean_dir, port) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to initialize session: {e}");
                std::process::exit(1);
            }
        },
    };

    // 2. Database Setup
    let db_path = kobean_dir.join("kobean.db");
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to open database at {:?}: {e}", db_path);
            std::process::exit(1);
        }
    };

    if let Err(e) = run_migrations(&conn) {
        eprintln!("Database migrations failed: {e}");
        std::process::exit(1);
    }

    if let Err(e) = seed_starter_data_if_empty(&conn) {
        eprintln!("Warning: Failed to seed starter data: {e}");
    }

    if let Err(e) = verify_backup_integrity(&db_path) {
        eprintln!("Database integrity check failed: {e}");
        std::process::exit(1);
    }

    println!("✓ SQLite Database: {:?}", db_path);
    println!("✓ WAL Mode & FTS5 Full-Text Engine: ACTIVE");
    println!("✓ Integrity Verification: PASSED");

    // 3. Start Localhost Server Daemon
    let db_arc = Arc::new(Mutex::new(conn));
    let server = HttpServer::new(session.port, session.token.clone(), db_arc);

    let (bound_port, _shutdown) = match server.start() {
        Ok(res) => res,
        Err(e) => {
            eprintln!("Failed to bind server daemon: {e}");
            std::process::exit(1);
        }
    };

    println!("✓ Daemon Listening on http://127.0.0.1:{}", bound_port);
    println!("✓ Loopback Session Token: ~/.kobean/session.json (0600)");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Ready for local browser & CI test result ingestion.\n");

    let should_open = !std::env::args().any(|arg| arg == "--headless" || arg == "--no-open")
        && std::env::var("CI").is_err();

    if should_open {
        let url = format!("http://127.0.0.1:{}", bound_port);
        println!("🚀 Launching KobeanTest Desktop Window at {}...", url);
        open_desktop_window(&url);
    }

    // Keep daemon running
    loop {
        std::thread::park();
    }
}

fn open_desktop_window(url: &str) {
    #[cfg(target_os = "macos")]
    {
        // Open as a dedicated standalone Desktop Application window via Brave, Chrome, or Edge
        let app_browsers = [
            "/Applications/Brave Browser.app",
            "/Applications/Google Chrome.app",
            "/Applications/Microsoft Edge.app",
        ];
        for app_path in &app_browsers {
            if std::path::Path::new(app_path).exists() {
                let status = std::process::Command::new("open")
                    .args(["-na", app_path, "--args", &format!("--app={}", url), "--window-size=1360,880"])
                    .spawn();
                if status.is_ok() {
                    return;
                }
            }
        }
        // Fallback to standard default browser
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let status = std::process::Command::new("cmd")
            .args(["/C", "start", "msedge", &format!("--app={}", url)])
            .spawn();
        if status.is_err() {
            let _ = std::process::Command::new("cmd").args(["/C", "start", url]).spawn();
        }
    }
    #[cfg(target_os = "linux")]
    {
        let status = std::process::Command::new("google-chrome")
            .args([&format!("--app={}", url), "--window-size=1360,880"])
            .spawn();
        if status.is_err() {
            let _ = std::process::Command::new("xdg-open").arg(url).spawn();
        }
    }
}

fn seed_starter_data_if_empty(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT count(*) FROM test_cases", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }

    // 1. Default Workspace & Project
    conn.execute(
        "INSERT OR IGNORE INTO workspaces (id, name, slug) VALUES (?1, ?2, ?3)",
        rusqlite::params!["ws-default", "Default Workspace", "default"],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO projects (id, workspace_id, name, key, description) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["proj-core", "ws-default", "Core Platform", "LOC", "Payment checkout, identity, and edge infrastructure"],
    )?;

    // 2. Test Suites
    conn.execute(
        "INSERT OR IGNORE INTO test_suites (id, project_id, title, description, position) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["suite-auth", "proj-core", "Authentication & Identity", "Biometrics, OAuth2, and Session lifecycle", 1],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO test_suites (id, project_id, title, description, position) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["suite-checkout", "proj-core", "Shopping Cart & Checkout", "Cart state mutations, payment processing, promo codes", 2],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO test_suites (id, project_id, title, description, position) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["suite-edge", "proj-core", "API Gateway & Edge", "Rate limiting, loopback auth, and telemetry", 3],
    )?;

    // 3. Test Cases
    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-1",
            "proj-core",
            "suite-auth",
            101,
            "Verify biometric 2FA step-up authentication on high-risk withdrawal",
            "User logged in with trusted device and high-value balance ($10,000+)",
            r#"[{"step_number": 1, "action": "Trigger withdrawal over $5,000 threshold", "expected": "System responds with 403 Challenge: Biometric Step-up Required"}, {"step_number": 2, "action": "Present valid WebAuthn/TouchID hardware credential", "expected": "200 OK signed signature token returned"}, {"step_number": 3, "action": "Confirm transaction execution", "expected": "Balance deducted and audit ledger entry written"}]"#,
            "critical",
            "automated",
            "auth.biometric.otp.stepup",
            r#"["security", "p0", "biometrics", "compliance"]"#
        ],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-2",
            "proj-core",
            "suite-auth",
            102,
            "Session token rotation on concurrent device login",
            "Active session exists on Device A",
            r#"[{"step_number": 1, "action": "Authenticate new login from Device B", "expected": "New session token issued with distinct device fingerprint"}, {"step_number": 2, "action": "Verify Device A receives silent invalidation ping", "expected": "Device A session revoked within 500ms"}]"#,
            "high",
            "automated",
            "auth.session.rotation",
            r#"["auth", "session", "security"]"#
        ],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-3",
            "proj-core",
            "suite-checkout",
            201,
            "Verify atomic cart checkout with Stripe 3D-Secure idempotency",
            "Cart contains 3 items totaling $249.99 with valid shipping address",
            r#"[{"step_number": 1, "action": "Submit checkout with Idempotency-Key header", "expected": "Payment intent created in RequiresAction state"}, {"step_number": 2, "action": "Simulate duplicate network request with same Idempotency-Key", "expected": "Original payment intent returned without double charge"}, {"step_number": 3, "action": "Complete 3DS challenge", "expected": "Order status moves to Confirmed; receipt email queued"}]"#,
            "critical",
            "automated",
            "checkout.stripe.3ds.idempotent",
            r#"["payments", "checkout", "p0", "stripe"]"#
        ],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-4",
            "proj-core",
            "suite-checkout",
            202,
            "Apply stackable discount coupon during flash sale countdown",
            "Active cart with minimum subtotal of $50",
            r#"[{"step_number": 1, "action": "Enter coupon code 'SUMMER50' into promo box", "expected": "Validating spinner appears for < 100ms; subtotal recalculated"}, {"step_number": 2, "action": "Inspect tax recalculation", "expected": "Sales tax updated accurately to post-discount total"}]"#,
            "medium",
            "manual",
            Option::<String>::None,
            r#"["checkout", "promotions", "ui"]"#
        ],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-5",
            "proj-core",
            "suite-edge",
            301,
            "Rate limiter enforces 100 req/min threshold on public edge endpoint",
            "Unauthenticated client IP",
            r#"[{"step_number": 1, "action": "Send 100 consecutive GET requests within 10 seconds", "expected": "All 100 requests return 200 OK with X-RateLimit-Remaining decrementing"}, {"step_number": 2, "action": "Send 101st request", "expected": "HTTP 429 Too Many Requests with Retry-After header"}]"#,
            "high",
            "automated",
            "edge.ratelimit.throttle",
            r#"["api", "performance", "infra"]"#
        ],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO test_cases (id, project_id, suite_id, case_number, title, preconditions, steps_json, priority, type, automation_id, tags_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            "case-6",
            "proj-core",
            "suite-edge",
            302,
            "FTS5 Porter stemmer query matches inflected search terms",
            "SQLite FTS5 virtual table populated with test cases",
            r#"[{"step_number": 1, "action": "Query FTS5 table for 'paying'", "expected": "Matches 'payment', 'pays', and 'payments' in < 2ms"}]"#,
            "medium",
            "automated",
            "search.fts5.porter.stemmer",
            r#"["search", "sqlite", "perf"]"#
        ],
    )?;

    // 4. Initial Test Run & Items
    conn.execute(
        "INSERT OR IGNORE INTO test_runs (id, project_id, title, environment, status, total_cases, passed_cases, failed_cases, blocked_cases, skipped_cases)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            "run-sprint-42",
            "proj-core",
            "Sprint 42 Release Regression",
            "Staging Localhost",
            "in_progress",
            6, 2, 1, 1, 0
        ],
    )?;

    let items = [
        ("item-1", "case-1", "passed", 142, None),
        ("item-2", "case-2", "passed", 88, None),
        ("item-3", "case-3", "failed", 310, Some("Idempotency collision on duplicate payload in mock sandbox")),
        ("item-4", "case-4", "pending", 0, None),
        ("item-5", "case-5", "blocked", 22, Some("Edge proxy rate limit bypass rule missing in staging")),
        ("item-6", "case-6", "pending", 0, None),
    ];

    for (item_id, case_id, status, duration, notes) in &items {
        conn.execute(
            "INSERT OR IGNORE INTO test_run_items (id, run_id, case_id, status, duration_ms, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![item_id, "run-sprint-42", case_id, status, duration, notes],
        )?;
    }

    println!("✓ Starter Sample Data: Seeded 3 suites, 6 cases, and 1 active test run");
    Ok(())
}
