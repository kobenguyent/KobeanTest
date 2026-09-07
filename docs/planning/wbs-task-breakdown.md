# KobeanTest — Hierarchical Work Breakdown Structure (WBS)

> **Document Type**: Work Breakdown Structure (WBS) Dictionary  
> **Total Sprints**: 7 Sprints (Sprint 0 through Sprint 6)  
> **Total Story Points**: 233 Story Points

---

## Complete WBS Dictionary

```text
WBS 0.0 - Governance, AI Harness & Monorepo Foundation (21 pts)
├── 0.1 Repository Setup & Git Hooks (5 pts)
│   ├── 0.1.1 Git repository initialization & branch 'main' baseline [DONE]
│   ├── 0.1.2 Configure .gitignore for Rust, Node, Tauri, SQLite [DONE]
│   ├── 0.1.3 Configure .betterleaks.toml secret scanner [DONE]
│   └── 0.1.4 Configure lefthook.yml pre-commit hooks [DONE]
├── 0.2 AI Agent Rules & Unified Knowledge Base (8 pts)
│   ├── 0.2.1 AGENTS.md & CLAUDE.md master routers [DONE]
│   ├── 0.2.2 .agents/rules/ core, ponytail, superpowers, taste, tauri, typescript, security [DONE]
│   ├── 0.2.3 .agents/personas/ CTO, SDET, Security Auditor, Designer [DONE]
│   ├── 0.2.4 .agents/skills/ new-adr, taste-skill, benchmark-ingest [DONE]
│   └── 0.2.5 .cursor/rules/*.mdc scoped files & mcp.json [DONE]
└── 0.3 Architectural Baseline & ADRs (8 pts)
    ├── 0.3.1 docs/architecture/system-overview.md C4 diagram [DONE]
    ├── 0.3.2 ADR-0001: Tauri v2 Desktop Shell [DONE]
    ├── 0.3.3 ADR-0002: SQLite FTS5 Localhost Storage [DONE]
    └── 0.3.4 ADR-0003: Embedded Localhost Web Server Daemon [DONE]

WBS 1.0 - Core Domain Contracts & Linear Design System (34 pts)
├── 1.1 Core Domain Models (packages/core) (13 pts)
│   ├── 1.1.1 Scaffold packages/core TypeScript ESM workspace
│   │   ├── Target File: packages/core/package.json, tsconfig.json
│   │   └── Dependencies: None | Complexity: Low | Pts: 2
│   ├── 1.1.2 Implement schemas.ts with Zod schemas for all entities
│   │   ├── Target File: packages/core/src/schemas.ts
│   │   └── Dependencies: 1.1.1 | Complexity: Med | Pts: 5
│   ├── 1.1.3 Implement types.ts inferring types from Zod schemas
│   │   ├── Target File: packages/core/src/types.ts
│   │   └── Dependencies: 1.1.2 | Complexity: Low | Pts: 2
│   ├── 1.1.4 Implement status.ts semantic color and icon mapping
│   │   ├── Target File: packages/core/src/status.ts
│   │   └── Dependencies: 1.1.2 | Complexity: Low | Pts: 2
│   └── 1.1.5 Unit test suite for schemas and status mapping
│       ├── Target File: packages/core/tests/schemas.test.ts
│       └── Dependencies: 1.1.2 | Complexity: Low | Pts: 2
└── 1.2 Linear-Grade Design System (packages/ui) (21 pts)
    ├── 1.2.1 Tailwind CSS v4 & theme token configuration
    │   ├── Target File: packages/ui/src/styles/theme.css
    │   └── Dependencies: None | Complexity: Med | Pts: 3
    ├── 1.2.2 Implement ThemeProvider (Obsidian, Nordic, Clean Paper, Warm Sand)
    │   ├── Target File: packages/ui/src/theme/theme-provider.tsx
    │   └── Dependencies: 1.2.1 | Complexity: Med | Pts: 4
    ├── 1.2.3 Build Accessible StatusPill component (Color + Icon + Text)
    │   ├── Target File: packages/ui/src/components/status-pill.tsx
    │   └── Dependencies: 1.1.4, 1.2.1 | Complexity: Low | Pts: 3
    ├── 1.2.4 Build CommandPalette (Cmd+K) modal with fuzzy search
    │   ├── Target File: packages/ui/src/components/command-palette.tsx
    │   └── Dependencies: 1.2.1 | Complexity: High | Pts: 5
    ├── 1.2.5 Build StepEditor with TipTap markdown & DOMPurify
    │   ├── Target File: packages/ui/src/components/step-editor.tsx
    │   └── Dependencies: 1.1.2, 1.2.1 | Complexity: High | Pts: 4
    └── 1.2.6 Execute Taste-Skill 7-point visual audit checklist
        ├── Target File: docs/design-system/audit-report.md
        └── Dependencies: 1.2.2, 1.2.3, 1.2.4, 1.2.5 | Complexity: Low | Pts: 2

WBS 2.0 - Local SQLite FTS5 Engine & Tauri v2 Shell (34 pts)
├── 2.1 Tauri v2 Native Shell (10 pts)
│   ├── 2.1.1 Scaffold apps/desktop/src-tauri with Cargo.toml & dependencies
│   │   ├── Target File: apps/desktop/src-tauri/Cargo.toml
│   │   └── Dependencies: None | Complexity: Low | Pts: 3
│   ├── 2.1.2 Configure tauri.conf.json with sandboxed window & capabilities
│   │   ├── Target File: apps/desktop/src-tauri/tauri.conf.json
│   │   └── Dependencies: 2.1.1 | Complexity: Med | Pts: 4
│   └── 2.1.3 Implement Rust main.rs entrypoint and error types
│       ├── Target File: apps/desktop/src-tauri/src/main.rs, error.rs
│       └── Dependencies: 2.1.2 | Complexity: Low | Pts: 3
├── 2.2 Embedded SQLite 3 & FTS5 Engine (13 pts)
│   ├── 2.2.1 Implement schema migrations and WAL journal configuration
│   │   ├── Target File: apps/desktop/src-tauri/src/db/migrations.rs
│   │   └── Dependencies: 2.1.1 | Complexity: Med | Pts: 4
│   ├── 2.2.2 Implement FTS5 virtual table fts5_cases & auto-sync triggers
│   │   ├── Target File: apps/desktop/src-tauri/src/db/fts.rs
│   │   └── Dependencies: 2.2.1 | Complexity: Med | Pts: 4
│   └── 2.2.3 Automated test verifying sub-5ms FTS5 search across 10k cases
│       ├── Target File: apps/desktop/src-tauri/tests/fts_benchmark.rs
│       └── Dependencies: 2.2.2 | Complexity: Med | Pts: 5
└── 2.3 Type-Safe Tauri IPC Commands (11 pts)
    ├── 2.3.1 Implement suite IPC handlers (list_suites, create_suite)
    │   ├── Target File: apps/desktop/src-tauri/src/commands/suites.rs
    │   └── Dependencies: 2.2.1 | Complexity: Low | Pts: 3
    ├── 2.3.2 Implement case CRUD handlers (list_cases, create_case, update_case)
    │   ├── Target File: apps/desktop/src-tauri/src/commands/cases.rs
    │   └── Dependencies: 2.2.2 | Complexity: Med | Pts: 4
    └── 2.3.3 Implement execution handlers (create_test_run, record_execution)
        ├── Target File: apps/desktop/src-tauri/src/commands/runs.rs
        └── Dependencies: 2.2.1 | Complexity: Med | Pts: 4

WBS 3.0 - Interactive UI & Test Case Management (55 pts)
├── 3.1 Three-Pane Layout Engine (13 pts)
│   ├── 3.1.1 Resizable 3-pane layout (Tree Left, Grid Center, Inspector Right)
│   ├── 3.1.2 Keyboard shortcuts for panel collapse ([ / ] and Cmd+B)
│   └── 3.1.3 Mobile and tablet responsive breakpoint adaptation
├── 3.2 Suite Tree Explorer (13 pts)
│   ├── 3.2.1 Recursive folder tree with nested suite counts
│   ├── 3.2.2 Drag-and-drop suite reordering
│   └── 3.2.3 Visual pass-rate progress indicators per suite
├── 3.3 High-Performance Virtual Grid (16 pts)
│   ├── 3.3.1 TanStack Virtual integration rendering 50,000+ test cases at 120 FPS
│   ├── 3.3.2 Multi-criteria filter bar (priority, type, tags, automation status)
│   └── 3.3.3 Column customization and sorting engine
└── 3.4 Keyboard-Driven Execution Mode (13 pts)
    ├── 3.4.1 J/K row navigation with optical highlight
    ├── 3.4.2 P (Pass), F (Fail), S (Skip) hotkeys with 0ms Optimistic UI
    └── 3.4.3 Background async persistence to SQLite

WBS 4.0 - Native Desktop Exploratory HUD & Capture (34 pts)
├── 4.1 Always-On-Top Mini-HUD Window (21 pts)
│   ├── 4.1.1 Multi-window Tauri configuration for 360x220px HUD
│   ├── 4.1.2 Mini-HUD UI with compact step action, expected result & hotkeys
│   └── 4.1.3 Sub-2ms local event bus syncing HUD state with main window
└── 4.2 Screenshot Capture & Annotation (13 pts)
    ├── 4.2.1 Native screen capture hook in Rust
    ├── 4.2.2 Clipboard paste handler (Cmd+V) with image crop & annotation tools
    └── 4.2.3 Save media locally to ~/.kobean/media/ and link in database

WBS 5.0 - Localhost Web Server & CI/CD Ingestion CLI (34 pts)
├── 5.1 Localhost Web Server Daemon (13 pts)
│   ├── 5.1.1 HTTP daemon bound to 127.0.0.1:4000
│   ├── 5.1.2 Static SPA file serving for Chrome, Safari, Firefox
│   └── 5.1.3 WebSocket hub for live multi-tab execution sync
├── 5.2 CI/CD Ingestion Engine (13 pts)
│   ├── 5.2.1 Streaming POST /api/v1/ci/ingest parser (Batch JSON & JUnit XML)
│   ├── 5.2.2 Auto-Case Provisioning resolving automation_id to test cases
│   └── 5.2.3 Chunked batch transaction insert (1,000 cases per transaction)
└── 5.3 @kobean/cli Test Runner Tool (8 pts)
    ├── 5.3.1 Scaffold CLI tool with Playwright runner wrapper
    └── 5.3.2 JUnit XML report submitter utility

WBS 6.0 - Hardening, Security Audit & Multi-OS Packaging (21 pts)
├── 6.1 Performance SLA Benchmarking (8 pts)
│   ├── 6.1.1 Cold start benchmark (< 200ms)
│   ├── 6.1.2 FTS5 50k search benchmark (< 5ms)
│   └── 6.1.3 CI 10k ingestion throughput benchmark (< 2.0s)
├── 6.2 Security & Secret Defense (5 pts)
│   ├── 6.2.1 Betterleaks full repository audit (0 leaks)
│   ├── 6.2.2 DOMPurify XSS injection fuzz test
│   └── 6.2.3 SQLite file permission verification (0700)
└── 6.3 Cross-Platform Packaging (8 pts)
    ├── 6.3.1 macOS Universal .dmg build & signing
    ├── 6.3.2 Windows .msi / .exe installer build
    └── 6.3.3 Linux .AppImage / .deb package build
```
