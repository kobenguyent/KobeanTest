# ADR-0003: Embedded Localhost Web Server Daemon

## Status
Accepted

## Context
While the primary interface is a native Tauri v2 desktop application, users also require the flexibility to access KobeanTest from any web browser on their machine (e.g. Chrome, Safari, Brave) at `http://localhost:4000`, as well as allowing local test runners (Playwright, Cypress, Pytest) to submit batch results via HTTP.

## Decision
We embed a lightweight local HTTP and WebSocket server daemon running on `http://127.0.0.1:4000`:
- Strictly bound to loopback (`127.0.0.1`) by default for security.
- Serves the static compiled React 19 Single Page App (SPA).
- Exposes REST endpoints for CRUD and high-throughput CI/CD batch test ingestion.
- Exposes a WebSocket hub for real-time live run updates and execution synchronization.

## Consequences
### Positive
- Full functional parity between the native desktop window and any local web browser.
- Universal ingestion point for test automation frameworks.
- Zero external internet traffic or cloud exposure.

### Negative / Trade-offs
- Port 4000 must be managed (handling port conflicts gracefully with auto-fallback to `4001`).
