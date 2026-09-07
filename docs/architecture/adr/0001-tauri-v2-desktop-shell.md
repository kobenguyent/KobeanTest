# ADR-0001: Adoption of Tauri v2 for Cross-Platform Desktop Shell

## Status
Accepted

## Context
KobeanTest requires a cross-platform desktop application for macOS, Windows, and Linux that feels instantaneous (< 200ms launch), consumes minimal RAM (< 50MB), and provides native OS hooks for screen recording and floating HUDs.

Electron was evaluated but rejected due to:
- High idle memory consumption (200MB–450MB RAM).
- Large installer binaries (120MB+).
- Broad Node.js attack surface inside webviews.

## Decision
We adopt **Tauri v2** with a compiled **Rust** core and OS-native webviews (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux).

## Consequences
### Positive
- Tiny binary distribution (~12MB).
- Idle memory footprint of ~35MB RAM.
- Compile-time memory safety in Rust with zero buffer overflows.
- Direct hardware access to native screen capture and local SQLite.
- Granular capability-based security model.

### Negative / Trade-offs
- Requires Rust toolchain for native desktop builds.
- Minor webview rendering nuances between platforms must be accounted for in CSS.
