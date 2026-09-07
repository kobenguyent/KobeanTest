#![deny(clippy::unwrap_used, clippy::expect_used)]

use kobean_core::db::{run_migrations, seed_starter_data, verify_backup_integrity};
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
    let mut conn = match Connection::open(&db_path) {
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

    if let Err(e) = seed_starter_data(&mut conn) {
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
