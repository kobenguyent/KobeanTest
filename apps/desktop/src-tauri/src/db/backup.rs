use rusqlite::{params, Connection, Result};
use std::path::Path;

/// Creates an atomic point-in-time backup using SQLite's native VACUUM INTO.
/// This safely flushes and snapshots the live WAL database into a clean standalone file.
pub fn create_atomic_backup(conn: &Connection, destination_path: &Path) -> Result<()> {
    if destination_path.exists() {
        std::fs::remove_file(destination_path)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    }

    let dest_str = destination_path.to_str().ok_or_else(|| {
        rusqlite::Error::ToSqlConversionFailure("Invalid UTF-8 destination path".into())
    })?;

    conn.execute("VACUUM INTO ?1;", params![dest_str])?;
    Ok(())
}

/// Opens a backup database file and executes PRAGMA integrity_check
pub fn verify_backup_integrity(backup_path: &Path) -> Result<bool> {
    let conn = Connection::open_with_flags(
        backup_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )?;

    let result: String = conn.query_row("PRAGMA integrity_check;", [], |row| row.get(0))?;
    Ok(result == "ok")
}
