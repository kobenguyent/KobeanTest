# ADR-0002: Embedded SQLite with FTS5 for 100% Localhost Storage

## Status
Accepted (Revised)

## Context
KobeanTest requires a data storage engine that:
- Runs 100% locally with zero cloud dependencies.
- Requires zero external database server installation or setup.
- Supports instant, sub-5ms full-text search across 50,000+ test cases.
- Supports concurrent read and write operations during automated test ingestion.

## Decision
We adopt **SQLite 3** compiled directly into the Rust application with:
- **Write-Ahead Logging (WAL)**: `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;` for concurrent read/write throughput.
- **FTS5 Virtual Table**: External content table linked by stable rowid to `test_cases`, with authoritative repopulation procedures.
- **Durability Trade-off**: `synchronous = NORMAL` provides high write throughput and protects against database corruption during application crashes, but a sudden OS power loss could theoretically lose the most recent uncheckpointed transaction. For a local developer tool, this is an acceptable, intentional performance trade-off.

## Backup & Recovery Architecture
- **NEVER perform raw OS file copies of `kobean.db` while the app is running.** Under WAL mode, active transactions reside in `kobean.db-wal`. Raw file copy produces incomplete or corrupted backups.
- **Atomic Backup Mechanism**: Backups are created via SQLite's native Online Backup API (`sqlite3_backup_*` in Rust via `rusqlite::backup`) or via `VACUUM INTO 'backup.db'`.
- **Media Preservation**: The backup routine bundles the generated `backup.db` and the referenced `~/.kobean/media/` assets into a single timestamped `.tar.gz` archive.

## Consequences
### Positive
- Fully consistent point-in-time snapshots without locking the database.
- Zero external software dependencies.
- Sub-5ms search queries executed directly against local NVMe storage.

### Negative / Trade-offs
- Backups must be initiated via the application daemon rather than external file watchers.
