#![deny(clippy::unwrap_used, clippy::expect_used)]

use kobean_core::db::run_migrations;
use rusqlite::Connection;

fn main() {
    println!("KobeanTest - 100% Localhost Test Management Core Initializing...");
    let conn = match Connection::open_in_memory() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = run_migrations(&conn) {
        eprintln!("Migration failed: {}", e);
        std::process::exit(1);
    }

    println!("KobeanTest Core Initialized Successfully with SQLite FTS5 WAL mode.");
}
