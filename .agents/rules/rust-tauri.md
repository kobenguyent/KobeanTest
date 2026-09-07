# Rust & Tauri v2 Standards — KobeanTest

Rules for the desktop native runtime (`apps/desktop/src-tauri`).

## 1. Rust Safety & Error Handling
- Rust Edition 2021+.
- **Zero `.unwrap()` or `.expect()` in production code paths**.
- Use `Result<T, AppError>` for all IPC commands where `AppError` implements `serde::Serialize` and `thiserror::Error`.
- Never panic inside an IPC command; return a structured error message to the webview.

## 2. Tauri v2 Security & Capabilities
- Never enable full shell or filesystem access to the webview.
- All IPC commands must be explicitly declared and scoped in `tauri.conf.json` capabilities.
- Local SQLite file path must be restricted to the OS user app data directory:
  - macOS: `~/Library/Application Support/KobeanTest/kobean.db`
  - Windows: `%APPDATA%/KobeanTest/kobean.db`
  - Linux: `~/.local/share/kobean-test/kobean.db`

## 3. SQLite & Search Performance
- Use `rusqlite` with Write-Ahead Logging (WAL) enabled:
  `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`
- Full-text search across test cases must query the `fts5_cases` virtual table using BM25 ranking.
- Batch inserts (e.g. CI ingestion) must execute within a single SQLite transaction.
