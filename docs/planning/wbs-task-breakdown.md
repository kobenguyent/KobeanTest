# KobeanTest — Hierarchical Work Breakdown Structure (WBS)

> **Document Type**: Work Breakdown Structure (WBS) Dictionary  
> **Structure**: Reorganized by Demonstrable Outcome Deliverables (1 through 6)  
> **Total Story Points**: 233 Story Points

---

## Complete WBS Dictionary

```text
DELIVERABLE 1.0 - Runnable Workspace & Unforgiving Quality Gates (21 pts) [DONE]
├── 1.1 Repository Setup & Git Hooks (8 pts) [DONE]
│   ├── 1.1.1 Git repository initialization & branch 'main' baseline [DONE]
│   ├── 1.1.2 Configure .gitignore for Rust, Node, Tauri, SQLite [DONE]
│   ├── 1.1.3 Configure .betterleaks.toml with zero-leak policy [DONE]
│   ├── 1.1.4 Configure lefthook.yml without failure suppressions (no || true) [DONE]
│   └── 1.1.5 Establish root package.json & pnpm-workspace.yaml with 'typecheck' script [DONE]
├── 1.2 AI Agent Rules & Unified Knowledge Base (8 pts) [DONE]
│   ├── 1.2.1 AGENTS.md & CLAUDE.md master routers [DONE]
│   ├── 1.2.2 .agents/rules/ with clippy::unwrap_used enforcement [DONE]
│   ├── 1.2.3 .agents/personas/ CTO, SDET, Security Auditor, Designer [DONE]
│   ├── 1.2.4 .agents/skills/ new-adr, taste-skill, benchmark-ingest [DONE]
│   └── 1.2.5 .cursor/rules/*.mdc scoped files & mcp.json [DONE]
└── 1.3 Architectural Baseline & ADRs (5 pts) [DONE]
    ├── 1.3.1 docs/architecture/system-overview.md C4 diagram [DONE]
    ├── 1.3.2 ADR-0001: Tauri v2 Desktop Shell [DONE]
    ├── 1.3.3 ADR-0002: SQLite FTS5 Localhost Storage & Native Backup API [DONE]
    └── 1.3.4 ADR-0003: Embedded Localhost Web Server Daemon [DONE]

DELIVERABLE 2.0 - Durable Authoring & Immutable Execution Engine (45 pts) [DONE]
├── 2.1 Core Schema & Domain Invariants (18 pts) [DONE]
│   ├── 2.1.1 Implement DDL migrations with project-scoped foreign keys [DONE]
│   │   ├── Target: apps/desktop/src-tauri/src/db/migrations.rs
│   │   └── Invariants: FOREIGN KEY (project_id, suite_id) REFERENCES test_suites(project_id, id)
│   ├── 2.1.2 Implement test_case_revisions table and version triggers [DONE]
│   ├── 2.1.3 Implement test_run_items and test_executions with ON DELETE RESTRICT [DONE]
│   ├── 2.1.4 Implement execution_step_results and step-linked attachments [DONE]
│   └── 2.1.5 Automated test: Deleting/editing test case leaves historical runs 100% intact [DONE]
├── 2.2 External FTS5 Search & Authoritative Repopulation (14 pts) [DONE]
│   ├── 2.2.1 Implement fts5_cases virtual table and auto-sync triggers [DONE]
│   ├── 2.2.2 Implement authoritative index repopulation query [DONE]
│   └── 2.2.3 Benchmark: Sub-5ms FTS5 search across 50,000 test cases [DONE]
└── 2.3 Rust Core IPC & Daemon Logic (13 pts) [DONE]
    ├── 2.3.1 Case CRUD operations with Result<T, AppError> (clippy::unwrap_used enforced) [DONE]
    ├── 2.3.2 Test run execution commands (create_run, record_execution) [DONE]
    └── 2.3.3 Loopback token generation (~/.kobean/session.json with 0600 permissions) [DONE]

DELIVERABLE 3.0 - Atomic Backup, Restore & Recovery Pipeline (21 pts) [DONE]
├── 3.1 Point-in-Time SQLite Backup API (13 pts) [DONE]
│   ├── 3.1.1 Implement VACUUM INTO routine [DONE]
│   ├── 3.1.2 Verify backup consistency during active WAL write transactions [DONE]
│   └── 3.1.3 Recovery testing under crash conditions [DONE]
└── 3.2 Recovery & Integrity Checks (8 pts) [DONE]
    ├── 3.2.1 On-startup PRAGMA integrity_check verification [DONE]
    ├── 3.2.2 FTS5 row count audit and auto-repair [DONE]
    └── 3.2.3 Automated test: Simulate crashed write and verify clean recovery [DONE]

DELIVERABLE 4.0 - Local Interactive Pilot Workflow (55 pts) [DONE]
├── 4.1 Linear-Grade Design System & Themes (13 pts) [DONE]
│   ├── 4.1.1 4 Curated Themes with mathematically verified WCAG AAA contrast [DONE]
│   ├── 4.1.2 Accessible StatusPill (Color + Lucide 1.75px Icon + Text) [DONE]
│   └── 4.1.3 Window-scoped hotkey manager (P, F, S active only on window focus) [DONE]
├── 4.2 Three-Pane Navigation & Hierarchy (16 pts) [DONE]
│   ├── 4.2.1 Collapsible Suite Tree with cycle prevention (CHECK parent_id != id) [DONE]
│   ├── 4.2.2 High-density Test Grid handling rapid row inspection [DONE]
│   └── 4.2.3 Multi-tag, priority, and type filtering bar [DONE]
├── 4.3 Notion-Style Markdown Step Editor (13 pts) [DONE]
│   ├── 4.3.1 Inline step authoring with action and expected results [DONE]
│   ├── 4.3.2 Reorder, delete, and step renumbering [DONE]
│   └── 4.3.3 Keystroke auto-drafting and version history tracking [DONE]
└── 4.4 Execution Mode with Optimistic UI (13 pts) [DONE]
    ├── 4.4.1 Three-state lifecycle: optimistic_pending -> persisted / failed_rollback [DONE]
    ├── 4.4.2 Single-character triage hotkeys (P, F, S, B) and J/K row navigation in 0ms [DONE]
    └── 4.4.3 Live aggregate progress bar (Passed, Failed, Blocked, Skipped) [DONE]

DELIVERABLE 5.0 - Browser Access & Idempotent CI Ingestion (45 pts) [DONE]
├── 5.1 Localhost Web Server Daemon (18 pts) [DONE]
│   ├── 5.1.1 Embedded HTTP server daemon bound to 127.0.0.1:4000 [DONE]
│   ├── 5.1.2 Loopback bearer token authentication & Host/Origin validation [DONE]
│   └── 5.1.3 REST endpoints for suites, cases, search, runs, and executions [DONE]
├── 5.2 Idempotent CI Ingestion Engine (16 pts) [DONE]
│   ├── 5.2.1 POST /api/v1/projects/:project_id/ci/ingest with idempotency_key [DONE]
│   ├── 5.2.2 Zero-dependency JUnit XML parser [DONE]
│   ├── 5.2.3 Auto-Case Provisioning resolving automation_id to project suites [DONE]
│   └── 5.2.4 Network duplicate rejection preserving idempotent test runs [DONE]
└── 5.3 @kobean/cli Test Runner Tool (11 pts) [DONE]
    ├── 5.3.1 CLI status discovery (kobean status) [DONE]
    └── 5.3.2 JUnit XML report submitter utility (kobean ingest) [DONE]

DELIVERABLE 6.0 - Native HUD & Verified Multi-OS Packaging (47 pts) [IN PROGRESS]
├── 6.1 Floating Mini-HUD (21 pts)
│   ├── 6.1.1 Multi-window Tauri configuration (always_on_top: true, 360x220px) [CONFIGURED]
│   ├── 6.1.2 Isolated Tauri capability set (tauri.conf.json) [CONFIGURED]
│   └── 6.1.3 Compact step execution HUD UI
├── 6.2 Native Screen Snapping (13 pts)
│   ├── 6.2.1 Hardware-accelerated screenshot capture hook in Rust
│   ├── 6.2.2 Clipboard paste handler (Cmd+V) with image annotation canvas
│   └── 6.2.3 Save media locally to ~/.kobean/media/ with 10GB quota enforcement
└── 6.3 Packaging & Distribution (13 pts)
    ├── 6.3.1 macOS Universal .dmg build & signing
    ├── 6.3.2 Windows .msi installer build
    └── 6.3.3 Linux .AppImage & .deb package build
```

---

## Deliverable Summary Progress
- **Completed**: 186 / 233 Story Points (**79.8% Completed**)
- **Remaining**: 47 Story Points (Native HUD & Packaging)
