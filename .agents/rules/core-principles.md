# Core Principles Rule — KobeanTest

## 1. 100% Localhost First (Zero Cloud)
- All user data, test suites, execution history, and bug screenshots stay strictly on the user's physical machine.
- No network requests may be made to external cloud servers, analytics trackers, or third-party telemetry.
- The web application connects only to loopback: `http://127.0.0.1:4000`.

## 2. Speed as Feature #1 (< 16ms SLA)
- Perceived latency for user actions (marking a test passed/failed, expanding a folder, switching suites) must be **0ms** using Optimistic UI.
- Local SQLite writes happen asynchronously in the background.
- UI rendering must maintain a steady 60–120 FPS. No unbounded DOM rendering.

## 3. Zero Licensing Cost ($0.00 Forever)
- Never introduce dependencies with proprietary, commercial, or viral licenses.
- Permissible licenses: MIT, Apache 2.0, BSD, ISC, PostgreSQL License, Public Domain.
- Example: Never use AG Grid Enterprise. Use `TanStack Virtual` or `Glide Data Grid` (Canvas).
