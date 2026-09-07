# KobeanTest — Titanium Master Implementation Plan

> **Document Status**: Approved & Baseline  
> **Authors**: Principal Software Architect, Lead Scrum Master, Principal Product Owner, QA Director  
> **Scope**: 100% Localhost Desktop & Web Test Management Platform  
> **Target Toolchain**: Tauri v2 + Rust 2021 + React 19 + TypeScript Strict + SQLite 3 FTS5 + Tailwind v4 + Shadcn UI  
> **Classification**: Engineering Architecture & Execution Plan

---

# Table of Contents
1. [Architectural Master Contracts](#1-architectural-master-contracts)
   - [1.1 SQLite Schema & FTS5 DDL](#11-sqlite-schema--fts5-ddl)
   - [1.2 Rust Tauri IPC Command Interface](#12-rust-tauri-ipc-command-interface)
   - [1.3 Core TypeScript & Zod Data Models](#13-core-typescript--zod-data-models)
   - [1.4 Localhost HTTP & WebSocket REST Contracts](#14-localhost-http--websocket-rest-contracts)
2. [Work Breakdown Structure (WBS) & Sprint Phases](#2-work-breakdown-structure-wbs--sprint-phases)
   - [Phase 0: Governance, AI Harness & Monorepo Foundation](#phase-0-governance-ai-harness--monorepo-foundation)
   - [Phase 1: Core Domain Contracts & Design System](#phase-1-core-domain-contracts--design-system)
   - [Phase 2: Local SQLite FTS5 Engine & Tauri v2 Shell](#phase-2-local-sqlite-fts5-engine--tauri-v2-shell)
   - [Phase 3: Interactive UI & Test Case Management](#phase-3-interactive-ui--test-case-management)
   - [Phase 4: Native Desktop Exploratory HUD & Capture](#phase-4-native-desktop-exploratory-hud--capture)
   - [Phase 5: Localhost Web Server & CI/CD Ingestion CLI](#phase-5-localhost-web-server--cicd-ingestion-cli)
   - [Phase 6: Hardening, Security Audit & Multi-OS Packaging](#phase-6-hardening-security-audit--multi-os-packaging)
3. [Failure Mode & Risk Mitigation Matrix (FMEA)](#3-failure-mode--risk-mitigation-matrix-fmea)
4. [Quantitative Performance SLAs & Verification Gates](#4-quantitative-performance-slas--verification-gates)

---

# 1. Architectural Master Contracts

## 1.1 SQLite Schema & FTS5 DDL

The database lives locally at `~/.kobean/kobean.db`. All connections must enforce:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### Complete DDL Specification
```sql
-- 1. Workspaces (Local Multi-Tenant / Profiles)
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key TEXT NOT NULL, -- e.g. "KB" for KB-101
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(workspace_id, key)
);

-- 3. Test Suites (Hierarchical Folder Tree)
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES test_suites(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_suites_project_parent ON test_suites(project_id, parent_id);

-- 4. Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    suite_id TEXT REFERENCES test_suites(id) ON DELETE SET NULL,
    case_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    preconditions TEXT,
    steps_json TEXT NOT NULL DEFAULT '[]', -- JSON array of Step items
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    type TEXT NOT NULL DEFAULT 'manual' CHECK(type IN ('manual', 'automated', 'exploratory', 'bdd')),
    automation_id TEXT, -- e.g. "e2e/auth.spec.ts#login"
    tags_json TEXT NOT NULL DEFAULT '[]', -- JSON array of string tags
    is_flaky INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(project_id, case_number)
);
CREATE INDEX IF NOT EXISTS idx_cases_suite ON test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_cases_automation_id ON test_cases(automation_id);

-- 5. Full-Text Search Virtual Table (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS fts5_cases USING fts5(
    case_id UNINDEXED,
    title,
    preconditions,
    steps_text,
    tags_text,
    tokenize='porter unicode61'
);

-- Triggers for FTS5 Synchronization
CREATE TRIGGER IF NOT EXISTS trg_cases_ai AFTER INSERT ON test_cases BEGIN
    INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text)
    VALUES (new.id, new.title, coalesce(new.preconditions, ''), new.steps_json, new.tags_json);
END;

CREATE TRIGGER IF NOT EXISTS trg_cases_ad AFTER DELETE ON test_cases BEGIN
    DELETE FROM fts5_cases WHERE case_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_cases_au AFTER UPDATE ON test_cases BEGIN
    DELETE FROM fts5_cases WHERE case_id = old.id;
    INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text)
    VALUES (new.id, new.title, coalesce(new.preconditions, ''), new.steps_json, new.tags_json);
END;

-- 6. Test Runs (Execution Sessions)
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'local',
    source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'ci', 'scheduled')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'aborted')),
    total_count INTEGER NOT NULL DEFAULT 0,
    passed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER
);

-- 7. Test Executions (Run Item Results)
CREATE TABLE IF NOT EXISTS test_executions (
    id TEXT PRIMARY KEY NOT NULL,
    test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'blocked', 'skipped')),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    stack_trace TEXT,
    notes TEXT,
    executed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_exec_run_case ON test_executions(test_run_id, test_case_id);

-- 8. Execution Attachments (Media & Logs)
CREATE TABLE IF NOT EXISTS execution_attachments (
    id TEXT PRIMARY KEY NOT NULL,
    execution_id TEXT NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

---

## 1.2 Rust Tauri IPC Command Interface

Every command is compiled into the native binary and returns `Result<T, AppError>` where `AppError` maps to a structured JSON object `{ code: string, message: string }`.

```rust
// apps/desktop/src-tauri/src/commands/mod.rs

#[tauri::command]
pub async fn list_suites(project_id: String) -> Result<Vec<TestSuiteDto>, AppError>;

#[tauri::command]
pub async fn create_suite(input: CreateSuiteInput) -> Result<TestSuiteDto, AppError>;

#[tauri::command]
pub async fn list_cases(filter: TestCaseFilter) -> Result<TestCasePageDto, AppError>;

#[tauri::command]
pub async fn get_case_by_id(case_id: String) -> Result<TestCaseDetailDto, AppError>;

#[tauri::command]
pub async fn create_case(input: CreateCaseInput) -> Result<TestCaseDetailDto, AppError>;

#[tauri::command]
pub async fn update_case(case_id: String, input: UpdateCaseInput) -> Result<TestCaseDetailDto, AppError>;

#[tauri::command]
pub async fn delete_case(case_id: String) -> Result<bool, AppError>;

#[tauri::command]
pub async fn search_cases(query: String, project_id: String, limit: u32) -> Result<Vec<SearchResultDto>, AppError>;

#[tauri::command]
pub async fn create_test_run(input: CreateRunInput) -> Result<TestRunDto, AppError>;

#[tauri::command]
pub async fn record_execution(input: RecordExecutionInput) -> Result<TestExecutionDto, AppError>;

#[tauri::command]
pub async fn capture_screen_clip(duration_secs: u32) -> Result<AttachmentDto, AppError>;
```

---

## 1.3 Core TypeScript & Zod Data Models

Located in `packages/core/src/schemas.ts`:

```typescript
import { z } from 'zod';

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const TestTypeSchema = z.enum(['manual', 'automated', 'exploratory', 'bdd']);
export const ExecutionStatusSchema = z.enum(['passed', 'failed', 'blocked', 'skipped']);

export const TestStepSchema = z.object({
  step_number: z.number().int().positive(),
  action: z.string().min(1, "Step action cannot be empty"),
  expected: z.string().min(1, "Expected result cannot be empty"),
  data: z.string().optional(),
});

export const TestCaseSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  suite_id: z.string().uuid().nullable(),
  case_number: z.number().int().positive(),
  title: z.string().min(1).max(500),
  preconditions: z.string().nullable(),
  steps: z.array(TestStepSchema),
  priority: PrioritySchema,
  type: TestTypeSchema,
  automation_id: z.string().nullable(),
  tags: z.array(z.string()),
  is_flaky: z.boolean(),
  version: z.number().int().positive(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestStep = z.infer<typeof TestStepSchema>;
```

---

## 1.4 Localhost HTTP & WebSocket REST Contracts

Bound strictly to `127.0.0.1:4000`:

| Method | Path | Request Body / Query | Response | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | None | `{ "status": "ok", "version": "0.1.0" }` | Health check & port discovery |
| `GET` | `/api/v1/projects/:id/cases` | `?q=auth&priority=high&page=1` | `{ "cases": TestCase[], "total": 142 }` | List cases with FTS5 search |
| `POST` | `/api/v1/projects/:id/cases` | `CreateCaseInput` (JSON) | `TestCase` (201 Created) | Create a test case |
| `POST` | `/api/v1/ci/ingest` | Batch JSON or JUnit XML | `{ "run_id": "...", "ingested": 450 }` | High-throughput CI result stream |
| `WS` | `/ws/runs/:run_id` | Upgrade to WebSocket | Stream of `ExecutionUpdateEvent` | Real-time live run sync |

---

# 2. Work Breakdown Structure (WBS) & Sprint Phases

## Phase 0: Governance, AI Harness & Monorepo Foundation
- [x] **TASK-0.1**: Initialize Git repository on branch `main`.
- [x] **TASK-0.2**: Author `AGENTS.md` and `CLAUDE.md` root instruction routers.
- [x] **TASK-0.3**: Scaffold `.agents/rules/` (Core, Ponytail, Superpowers, Taste, Tauri, TypeScript, Security).
- [x] **TASK-0.4**: Scaffold `.agents/personas/` (CTO, SDET, Security Auditor, UI Designer).
- [x] **TASK-0.5**: Scaffold `.agents/skills/` (`new-adr`, `taste-skill`, `benchmark-ingest`).
- [x] **TASK-0.6**: Scaffold `.cursor/rules/*.mdc` with scoped glob matching.
- [x] **TASK-0.7**: Configure `.claude/settings.json`, `.betterleaks.toml`, `lefthook.yml`, and `.beads/state.json`.
- [x] **TASK-0.8**: Author Architecture Decision Records (ADR-0001, ADR-0002, ADR-0003) and product PRDs in `docs/`.

---

## Phase 1: Core Domain Contracts & Design System
**Story Points**: 34 | **Target**: `packages/core` & `packages/ui`

### Detailed Task Decomposition:
* **TASK-1.1 (`packages/core`)**:
  - `TASK-1.1.1`: Setup `packages/core` package with TypeScript 5.5+ and strict ESM compilation.
  - `TASK-1.1.2`: Implement `schemas.ts` with complete Zod schemas for all domain entities.
  - `TASK-1.1.3`: Implement `types.ts` inferring types from Zod schemas.
  - `TASK-1.1.4`: Implement `status.ts` defining semantic colors, icon mapping, and label descriptors.
  - `TASK-1.1.5`: Write Vitest unit test suite verifying schema validation rules and edge cases.
* **TASK-1.2 (`packages/ui`)**:
  - `TASK-1.2.1`: Configure Tailwind CSS v4 with design tokens matching 4 themes (Obsidian, Nordic Slate, Clean Paper, Warm Sand).
  - `TASK-1.2.2`: Implement `ThemeProvider` with zero-flash localStorage theme persistence.
  - `TASK-1.2.3`: Build `StatusPill` component combining Color + Lucide 1.75px icon + Text with WCAG AAA contrast.
  - `TASK-1.2.4`: Build `CommandPalette` (`Cmd + K`) using Radix dialog primitive with fuzzy search ranking.
  - `TASK-1.2.5`: Build `StepEditor` with TipTap and DOMPurify for inline markdown test authoring.
  - `TASK-1.2.6`: Run Taste-Skill 7-point visual audit checklist on all components.

---

## Phase 2: Local SQLite FTS5 Engine & Tauri v2 Shell
**Story Points**: 34 | **Target**: `apps/desktop/src-tauri`

### Detailed Task Decomposition:
* **TASK-2.1 (Tauri v2 Workspace Setup)**:
  - `TASK-2.1.1`: Initialize Tauri v2 application in `apps/desktop/src-tauri` with Cargo.toml dependencies (`tauri 2.0`, `rusqlite 0.32`, `tokio`, `serde`).
  - `TASK-2.1.2`: Configure `tauri.conf.json` with secure sandboxed window, custom titlebar, and minimal capabilities.
* **TASK-2.2 (Embedded SQLite & FTS5 Engine)**:
  - `TASK-2.2.1`: Implement `db/migrations.rs` executing the complete DDL schema and index triggers.
  - `TASK-2.2.2`: Configure WAL journal mode and busy timeout connection pooling in Rust.
  - `TASK-2.2.3`: Implement `db/fts.rs` with BM25 ranked search queries across test cases.
* **TASK-2.3 (Tauri IPC Layer)**:
  - `TASK-2.3.1`: Define `error.rs` mapping database errors to serialized `AppError`.
  - `TASK-2.3.2`: Implement case CRUD IPC commands (`list_cases`, `create_case`, `update_case`, `delete_case`).
  - `TASK-2.3.3`: Implement search IPC command (`search_cases`) verifying `< 5ms` execution time over 1,000 cases.
  - `TASK-2.3.4`: Implement test execution IPC commands (`create_test_run`, `record_execution`).

---

## Phase 3: Interactive UI & Test Case Management
**Story Points**: 55 | **Target**: `apps/desktop/src` (and shared web UI)

### Detailed Task Decomposition:
* **TASK-3.1 (Three-Pane Layout Engine)**:
  - `TASK-3.1.1`: Implement responsive resizable panels (Suite Tree Left, Grid Center, Inspector Right).
  - `TASK-3.1.2`: Implement keyboard shortcuts for panel collapse (`[` / `]` and `Cmd + B`).
* **TASK-3.2 (Suite Tree Explorer)**:
  - `TASK-3.2.1`: Render recursive folder tree with smooth drag-and-drop suite reordering.
  - `TASK-3.2.2`: Add suite pass-rate progress indicators and test count badges.
* **TASK-3.3 (High-Performance Virtual Grid)**:
  - `TASK-3.3.1`: Integrate `TanStack Virtual` rendering only visible rows for 50,000+ test cases.
  - `TASK-3.3.2`: Implement multi-tag and priority filter bar with instant client-side filtering.
* **TASK-3.4 (Keyboard Execution Engine)**:
  - `TASK-3.4.1`: Implement `J` / `K` row navigation with optical highlight.
  - `TASK-3.4.2`: Wire `P` (Pass), `F` (Fail), `S` (Skip) hotkeys with Optimistic UI updates (0ms perceived latency).
  - `TASK-3.4.3`: Wire async background SQLite persistence.

---

## Phase 4: Native Desktop Exploratory HUD & Capture
**Story Points**: 34 | **Target**: Native Desktop Hooks

### Detailed Task Decomposition:
* **TASK-4.1 (Floating Mini-HUD Window)**:
  - `TASK-4.1.1`: Implement multi-window spawning in Tauri v2 (`always_on_top: true`, 360x220px).
  - `TASK-4.1.2`: Build compact step execution HUD displaying step action, expected result, and hotkey triggers.
  - `TASK-4.1.3`: Implement local event bus syncing execution state between main window and HUD in `< 2ms`.
* **TASK-4.2 (Native Screen Capture & Annotation)**:
  - `TASK-4.2.1`: Implement desktop screenshot capture via native platform APIs (macOS ScreenCaptureKit, Windows DXGI).
  - `TASK-4.2.2`: Build clipboard paste handler (`Cmd + V`) with image crop and annotation canvas (arrows, red box, blur).
  - `TASK-4.2.3`: Save media files to `~/.kobean/media/` and record attachment references in SQLite.

---

## Phase 5: Localhost Web Server & CI/CD Ingestion CLI
**Story Points**: 34 | **Target**: `packages/server` & `packages/cli`

### Detailed Task Decomposition:
* **TASK-5.1 (Localhost HTTP & WS Daemon)**:
  - `TASK-5.1.1`: Implement lightweight HTTP/WS server strictly bound to `127.0.0.1:4000`.
  - `TASK-5.1.2`: Serve compiled static React 19 SPA assets.
  - `TASK-5.1.3`: Implement WebSocket room hub for test run progress broadcasts.
* **TASK-5.2 (CI/CD Batch Ingestion Engine)**:
  - `TASK-5.2.1`: Implement `POST /api/v1/ci/ingest` with streaming JSON and JUnit XML parser.
  - `TASK-5.2.2`: Implement Auto-Case Provisioning (`auto_create_cases: true`) resolving `automation_id`s into suites.
  - `TASK-5.2.3`: Implement chunked transaction batch insert (1,000 cases per transaction) preventing SQLite locking.
* **TASK-5.3 (`@kobean/cli` Ingestion Tool)**:
  - `TASK-5.3.1`: Scaffold CLI binary with `commander` or native Rust binary.
  - `TASK-5.3.2`: Implement Playwright runner wrapper (`npx kobean run --playwright`).
  - `TASK-5.3.3`: Implement JUnit XML reporter parser (`npx kobean report --format junit`).

---

## Phase 6: Hardening, Security Audit & Multi-OS Packaging
**Story Points**: 21 | **Target**: Production Readiness

### Detailed Task Decomposition:
* **TASK-6.1 (SLA Verification & Benchmarking)**:
  - `TASK-6.1.1`: Run automated benchmark inserting 50,000 test cases and verifying `< 5ms` FTS5 queries.
  - `TASK-6.1.2`: Verify cold start time is `< 200ms` on macOS and Windows.
  - `TASK-6.1.3`: Verify UI scrolling remains at 60–120 FPS.
* **TASK-6.2 (Security & Secret Defense Audit)**:
  - `TASK-6.2.1`: Run `betterleaks scan` verifying 0 credentials.
  - `TASK-6.2.2`: Perform DOMPurify XSS fuzz test injecting malicious HTML/scripts into test steps.
  - `TASK-6.2.3`: Verify local SQLite file permissions are `0700`.
* **TASK-6.3 (Cross-Platform Distribution Packaging)**:
  - `TASK-6.3.1`: Build macOS `.dmg` (Universal Apple Silicon & Intel) with code signing.
  - `TASK-6.3.2`: Build Windows `.msi` / `.exe` installer.
  - `TASK-6.3.3`: Build Linux `.AppImage` and `.deb` packages.

---

# 3. Failure Mode & Risk Mitigation Matrix (FMEA)

| # | Potential Failure Mode | Severity | Likelihood | Technical Mitigation Strategy |
| :-: | :--- | :-: | :-: | :--- |
| **1** | **SQLite WAL Bloat**: Large automated runs cause `.db-wal` file to grow to gigabytes. | High | Med | Enable `PRAGMA wal_autocheckpoint = 1000;` and trigger background `PRAGMA wal_checkpoint(TRUNCATE)` after every completed test run. |
| **2** | **Port 4000 Conflict**: Another service already occupies port 4000 on localhost. | Med | Med | Daemon probes port 4000; if occupied, automatically checks 4001, 4002, 4003, and writes active port to `~/.kobean/daemon.json`. |
| **3** | **Malformed CI/CD XML**: CI runner uploads corrupted or truncated JUnit XML. | High | Med | Use streaming XML parser with lenient recovery (`quick-xml`); return partial ingest report with specific line error diagnostics. |
| **4** | **Excessive Media Storage**: 1080p bug recordings exhaust local SSD space. | High | Low | Implement configurable quota (default: 10GB) in `~/.kobean/config.json` with LRU auto-cleanup of attachments older than 90 days. |
| **5** | **XSS in Test Steps**: Malicious scripts in failure logs exploit webview. | Critical | Low | Enforce strict CSP in Tauri and web headers; run all markdown through DOMPurify before React DOM rendering. |
| **6** | **Concurrent Write Lock**: Desktop app and CI CLI write to SQLite simultaneously. | High | Med | Set `PRAGMA busy_timeout = 5000;` and use a serialized write queue in the Rust/Node backend daemon. |

---

# 4. Quantitative Performance SLAs & Verification Gates

| Metric | Target SLA | Benchmark Baseline (TestRail) | Automated Verification Command |
| :--- | :--- | :--- | :--- |
| **Desktop Launch Time** | `< 200 ms` | `2,500 ms` (Web reload) | `cargo test --bench bench_cold_start` |
| **FTS5 Search Query** | `< 5 ms` (50k items) | `1,200 ms` (Server SQL) | `cargo test --bench bench_fts5_search` |
| **Status Mutation Latency** | `0 ms` (Optimistic) | `500 ms` (Spinner) | Vitest component test with fake timers |
| **CI Ingest Throughput** | `< 2.0s` (10,000 tests)| `30,000 ms` (or HTTP 504) | `pnpm benchmark:ingest` |
| **Idle Memory Footprint** | `< 45 MB RAM` | `300 MB` (Electron) | Activity Monitor / Task Manager audit |
| **Scrolling Frame Rate** | `60–120 FPS` | `15–20 FPS` (DOM choke) | Chrome DevTools Performance Trace |
