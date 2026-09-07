# KobeanTest — Failure Modes & Risk Mitigation Matrix (FMEA)

> **Standard**: Failure Mode and Effects Analysis (FMEA)  
> **Target**: 100% Localhost High-Performance Test Management Engine

---

## 1. Risk Analysis & Scoring System
- **Severity (S)**: 1 (Minor) to 5 (System Halt / Data Loss)
- **Likelihood (L)**: 1 (Rare) to 5 (Frequent)
- **Detection (D)**: 1 (Immediately Obvious) to 5 (Silent Failure)
- **Risk Priority Number (RPN)**: $S \times L \times D$ (Range: 1 to 125). Items with RPN > 25 require mandatory automated mitigations.

---

## 2. FMEA Matrix

| Risk ID | Failure Mode Description | S | L | D | RPN | Mitigation Strategy & Architecture Defense |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| **RSK-01** | **SQLite WAL File Growth**: High-frequency CI ingestion pushes thousands of test results, causing the `-wal` file to grow to multiple gigabytes without checkpointing. | 4 | 3 | 3 | **36** | • Set `PRAGMA wal_autocheckpoint = 1000;`<br>• Enforce background `PRAGMA wal_checkpoint(TRUNCATE)` immediately upon test run completion.<br>• Implement a periodic 5-minute health check that runs an explicit checkpoint if WAL size exceeds 50MB. |
| **RSK-02** | **Port 4000 Collisions**: Another developer tool or local web server is already listening on `127.0.0.1:4000`. | 3 | 3 | 2 | **18** | • Implement an incremental port scanner probing `4000..=4010`.<br>• Write active port dynamically to `~/.kobean/daemon.json`.<br>• Desktop app and CLI read `daemon.json` to discover the live port automatically. |
| **RSK-03** | **Malformed or Truncated JUnit XML**: Test runner dies mid-execution or produces invalid XML. | 3 | 3 | 2 | **18** | • Use a streaming XML parser (`quick-xml` or `fast-xml-parser`) with recovery mode.<br>• Commit all successfully parsed test cases up to the error point in a transaction.<br>• Return a structured diagnostic report indicating exact line and byte offset of XML corruption. |
| **RSK-04** | **Disk Space Exhaustion (Media / Screen Clips)**: Testers recording high-framerate bug videos fill up local drive space. | 4 | 2 | 3 | **24** | • Implement configurable media storage quota in `~/.kobean/config.json` (default 10GB).<br>• Auto-compress MP4 recordings using hardware-accelerated H.264/H.265 in Rust.<br>• Provide one-click "Purge Media Older Than 60 Days" in Settings. |
| **RSK-05** | **XSS Injection in Test Case Steps**: Malicious test payloads, failure logs, or stack traces contain script tags that attempt to exploit the webview. | 5 | 1 | 3 | **15** | • Enforce strict Content Security Policy (CSP): `script-src 'self'`.<br>• All markdown, TipTap steps, and stack traces pass through `DOMPurify` before DOM rendering.<br>• Tauri IPC commands strictly sanitize input strings. |
| **RSK-06** | **SQLite Concurrency & Database Locks**: Desktop GUI and CI ingestion process write simultaneously, triggering `SQLITE_BUSY`. | 4 | 3 | 2 | **24** | • Enforce `PRAGMA busy_timeout = 5000;` on all connections.<br>• Local daemon maintains a single-writer MPSC (Multi-Producer Single-Consumer) queue in Rust/Tokio for all write transactions. Reads remain completely lock-free via WAL mode. |
| **RSK-07** | **Large DOM Choking (50,000+ Test Cases)**: Opening a massive suite causes browser layout engine to drop below 15 FPS. | 3 | 4 | 1 | **12** | • Strictly forbid unbounded `map()` rendering.<br>• Enforce `TanStack Virtual` or `Glide Data Grid` (Canvas).<br>• DOM renders only the ~35 rows visible in the viewport. Memory stays completely flat. |
| **RSK-08** | **OS Version Differences (macOS, Windows, Linux)**: Native screen capture APIs behave differently across OS versions (e.g. ScreenCaptureKit on macOS vs DXGI on Windows vs PipeWire on Linux). | 3 | 3 | 2 | **18** | • Wrap screen capture behind an abstract Rust trait `ScreenCaptureBackend`.<br>• Implement platform-specific drivers with graceful fallback to standard window screenshots if hardware APIs are unavailable. |

---

## 3. Automated Health Verification Checks

The local daemon runs these automated diagnostics on startup:
1. **WAL Integrity Check**: `PRAGMA integrity_check;` executed on cold start.
2. **FTS5 Index Consistency**: Verifies count of rows in `test_cases` matches count of entries in `fts5_cases`. If divergent, automatically executes `INSERT INTO fts5_cases(fts5_cases) VALUES('rebuild');`.
3. **Port Binding Verification**: Validates loopback binding strictly to `127.0.0.1` (never `0.0.0.0` for security).
