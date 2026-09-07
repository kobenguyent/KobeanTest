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
        println!("🚀 Launching KobeanTest at {}...", url);
        open_in_browser(&url);
    }

    // Keep daemon running
    loop {
        std::thread::park();
    }
}

fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", url]).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}
