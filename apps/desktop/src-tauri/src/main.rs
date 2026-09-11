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

    let should_open = !std::env::args().any(|arg| arg == "--headless" || arg == "--no-open")
        && std::env::var("CI").is_err();

    // Check if an existing KobeanTest daemon is already active on the session port
    let is_already_running = if let Ok(mut stream) = std::net::TcpStream::connect(format!("127.0.0.1:{}", session.port)) {
        use std::io::{Read, Write};
        let _ = stream.set_read_timeout(Some(std::time::Duration::from_millis(250)));
        if stream.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n").is_ok() {
            let mut buf = [0u8; 512];
            match stream.read(&mut buf) {
                Ok(n) => String::from_utf8_lossy(&buf[..n]).contains("kobeantest-localhost-daemon"),
                Err(_) => false,
            }
        } else {
            false
        }
    } else {
        false
    };

    if is_already_running {
        println!("✓ Active KobeanTest daemon detected on http://127.0.0.1:{}", session.port);
        println!("✓ Loopback Session Token: ~/.kobean/session.json (0600)");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        if should_open {
            let url = format!("http://127.0.0.1:{}", session.port);
            println!("🚀 Launching KobeanTest Desktop Window at {}...", url);
            open_desktop_window(&url);
        }
        return;
    }

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

    if bound_port != session.port {
        println!("Notice: Port {} in use. Bound daemon to fallback port {}.", session.port, bound_port);
        let _ = create_session(&kobean_dir, bound_port);
    }

    println!("✓ Daemon Listening on http://127.0.0.1:{}", bound_port);
    println!("✓ Loopback Session Token: ~/.kobean/session.json (0600)");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Ready for local browser & CI test result ingestion.\n");

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
