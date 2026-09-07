use kobean_core::db::{create_atomic_backup, run_migrations, verify_backup_integrity};
use rusqlite::Connection;
use tempfile::tempdir;

#[test]
fn test_atomic_backup_under_wal_mode() {
    let dir = tempdir().expect("Temporary directory created");
    let db_path = dir.path().join("live.db");
    let backup_path = dir.path().join("backup.db");

    // 1. Create live database on disk with WAL mode
    let conn = Connection::open(&db_path).expect("Open live database");
    run_migrations(&conn).expect("Run migrations");

    // 2. Insert records
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES ('ws-1', 'WS', 'ws');", []).unwrap();
    conn.execute("INSERT INTO projects (id, workspace_id, name, key) VALUES ('proj-1', 'ws-1', 'P1', 'P1');", []).unwrap();

    for i in 1..=50 {
        conn.execute(
            "INSERT INTO test_cases (id, project_id, case_number, title)
             VALUES (?1, 'proj-1', ?2, ?3);",
            rusqlite::params![format!("case-{}", i), i, format!("Test Case {}", i)],
        ).unwrap();
    }

    // 3. Trigger atomic backup via native SQLite VACUUM INTO
    create_atomic_backup(&conn, &backup_path).expect("Atomic backup should succeed");
    assert!(backup_path.exists(), "Backup file must exist on disk");

    // 4. Verify integrity of the backup file
    let is_valid = verify_backup_integrity(&backup_path).expect("Integrity check should run");
    assert!(is_valid, "PRAGMA integrity_check must return 'ok'");

    // 5. Open backup directly and verify row count
    let backup_conn = Connection::open_with_flags(
        &backup_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ).expect("Open backup file");

    let count: i64 = backup_conn
        .query_row("SELECT count(*) FROM test_cases;", [], |row| row.get(0))
        .expect("Query case count");

    assert_eq!(count, 50, "All 50 test cases must be present in the point-in-time backup");
}
