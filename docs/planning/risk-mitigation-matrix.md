# KobeanTest — Failure Modes & Risk Mitigation Matrix (FMEA)

> **Standard**: Failure Mode and Effects Analysis (FMEA)  
> **Target**: 100% Localhost High-Performance Test Management Engine  
> **Version**: 1.1.0 (Post-Review Hardening)

---

## 1. Risk Analysis & Scoring System
- **Severity (S)**: 1 (Minor) to 5 (System Halt / Data Loss)
- **Likelihood (L)**: 1 (Rare) to 5 (Frequent)
- **Detection (D)**: 1 (Immediately Obvious) to 5 (Silent Failure)
- **Risk Priority Number (RPN)**: $S \times L \times D$ (Range: 1 to 125). Items with RPN > 25 require mandatory automated mitigations.

---

## 2. FMEA Matrix

| Risk ID | Failure Mode Description | S | L | D | RPN | Technical Mitigation Strategy & Architecture Defense |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| **RSK-01** | **Unsafe Backup & WAL Frame Loss**: Copying active `kobean.db` via file manager leaves active commits in `-wal`, resulting in a corrupt or incomplete backup. | 5 | 3 | 4 | **60** | • **Mandatory Backup API**: Backups are executed strictly via `VACUUM INTO 'backup.db'` or Rust `rusqlite::backup`.<br>• The backup routine packages `backup.db` and referenced `~/.kobean/media/` into an atomic archive.<br>• Document that `PRAGMA synchronous = NORMAL` trades potential loss of the most recent power-failure commit for 10x write throughput. |
| **RSK-02** | **FTS5 Index Desynchronization & Silent Failure**: Rows deleted from `fts5_cases` are not restored by FTS5's internal `'rebuild'` command. | 4 | 2 | 4 | **32** | • **Authoritative Repopulation Procedure**: Full index repairs execute:<br>`BEGIN TRANSACTION;`<br>`DELETE FROM fts5_cases;`<br>`INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text) SELECT id, title, coalesce(preconditions, ''), steps_json, tags_json FROM test_cases;`<br>`COMMIT;`<br>• Use stable rowid links or index `case_id` to prevent unindexed table scans on update/delete triggers. |
| **RSK-03** | **DNS Rebinding & Unauthorized Localhost Access**: A malicious website open in Chrome sends cross-origin requests to `http://127.0.0.1:4000`. | 5 | 2 | 3 | **30** | • **Loopback Token Bootstrapping**: Daemon generates a high-entropy secret token on startup written to `~/.kobean/session.token` (permissions `0600`).<br>• All HTTP and WebSocket requests must supply `Authorization: Bearer <token>`.<br>• Middleware strictly validates `Host: 127.0.0.1:4000` or `Host: localhost:4000` and rejects untrusted `Origin` headers. |
| **RSK-04** | **Optimistic Update Write Failure / App Close**: User marks test Passed in 0ms, but background SQLite write fails or user quits during autosave debounce. | 4 | 2 | 3 | **24** | • **Three-State Lifecycle**: Items transition `saving` -> `saved` -> `failed`.<br>• If a write fails, display a non-blocking toast with a "Retry / Revert" prompt; do not silently leave a green checkmark.<br>• Unsaved edits during debounce write to local `sessionStorage` draft recovery immediately on keystroke; before app exit, intercept `beforeunload` / Tauri close event to flush pending writes. |
| **RSK-05** | **CI Batch Retries & Idempotency Violations**: Network retry sends duplicate CI results, inflating run totals or creating duplicate test cases. | 4 | 2 | 2 | **16** | • `POST /api/v1/projects/:id/ci/ingest` requires an `idempotency_key` or `run_key`.<br>• Ingestion engine checks for existing `run_key`. If matched, returns existing run summary or merges idempotently rather than duplicating. |
| **RSK-06** | **Malformed or Truncated JUnit XML**: Test runner crashes mid-execution, uploading incomplete XML. | 3 | 3 | 2 | **18** | • Use a streaming XML parser (`quick-xml`) with recovery mode.<br>• Ingestion runs inside a chunked transaction (1,000 items per chunk). Successfully parsed chunks are committed; the response contract returns an explicit diagnostic `{ ingested_count: 450, error: "XML EOF at line 124" }`. |
| **RSK-07** | **Disk Space Exhaustion (Media / Screen Clips)**: Bug video recordings exhaust local drive space. | 4 | 2 | 3 | **24** | • Implement configurable media storage quota in `~/.kobean/config.json` (default 10GB).<br>• Reconcile media deletion: automated quota alerts prompt user; auto-compression to H.264 MP4 reduces clip size by 80%. |
| **RSK-08** | **Tauri Capability Leak Between Windows**: HUD window gains access to administrative or system IPC commands meant only for main window. | 4 | 2 | 2 | **16** | • Use Tauri v2 separate capability sets (`main-window.json` vs `hud-window.json`).<br>• HUD window capability allowlist is restricted strictly to `record_execution` and `capture_screen_clip`. |

---

## 3. Automated Health Verification Checks

The local daemon runs these automated diagnostics on startup:
1. **WAL Integrity Check**: `PRAGMA integrity_check;` executed on cold start.
2. **Authoritative FTS5 Audit**: Verifies row counts between `test_cases` and `fts5_cases`. If mismatched, triggers the authoritative repopulation query.
3. **Port & Origin Verification**: Binds strictly to `127.0.0.1` and validates token security.
