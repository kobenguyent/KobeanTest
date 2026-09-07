# KobeanTest — Scrum Roadmap & Sprint Breakdown

This document outlines the product delivery roadmap, organized into structured Scrum Epics and Sprints, authored from the perspective of a Lead Scrum Master and Principal Product Owner.

---

## Epic Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       KOBEANTEST DELIVERY ROADMAP                           │
├────────────┬─────────────────────────────────────────────────┬──────────────┤
│ Sprint     │ Epic & Focus Area                               │ Target Story │
├────────────┼─────────────────────────────────────────────────┼──────────────┤
│ Sprint 0   │ Governance, AI Harness & Monorepo Scaffold      │ 21 pts       │
│ Sprint 1   │ Core Domain Contracts & Linear Design System    │ 34 pts       │
│ Sprint 2   │ Local SQLite Engine & Tauri v2 Shell            │ 34 pts       │
│ Sprint 3   │ Interactive UI & Test Case Management           │ 55 pts       │
│ Sprint 4   │ Exploratory Testing & Floating Mini-HUD         │ 34 pts       │
│ Sprint 5   │ Localhost Web Server & CI/CD Ingestion CLI      │ 34 pts       │
│ Sprint 6   │ Hardening, Benchmarking & Multi-OS Packaging    │ 21 pts       │
└────────────┴─────────────────────────────────────────────────┴──────────────┘
```

---

## Sprint 0: Governance, AI Harness & Repository Foundation (21 Story Points)
**Goal**: Establish zero-ambiguity AI engineering rules, Git hooks, and documentation structure.

### User Stories:
* **US-0.1 (Architecture & Governance)**: As a system architect, I want ADRs and system diagrams documented in `docs/` so all contributors understand the localhost architecture.
  - *Acceptance Criteria*: ADR-0001, ADR-0002, ADR-0003 committed; C4 diagram in `docs/architecture/system-overview.md`.
* **US-0.2 (AI Agent Harness)**: As an engineering lead, I want `.agents/`, `.cursor/`, and `.claude/` configured so that AI agents produce high-discipline, non-bloated code.
  - *Acceptance Criteria*: Ponytail, Superpowers, and Taste-Skill rules written; `.cursor/rules/*.mdc` scoped; `.claude/settings.json` allowlisted.
* **US-0.3 (Secret Scanning & Git Hooks)**: As a security officer, I want Betterleaks scanning enabled on pre-commit so no tokens or secrets are committed.
  - *Acceptance Criteria*: `lefthook.yml` and `.betterleaks.toml` configured and passing.

---

## Sprint 1: Core Domain Contracts & Linear Design System (34 Story Points)
**Goal**: Establish strictly-typed data models in `packages/core` and the Tailwind v4 / Shadcn UI design system in `packages/ui`.

### User Stories:
* **US-1.1 (Domain Models & Zod Schemas)**: As a developer, I want validated schemas for `TestCase`, `TestSuite`, `TestRun`, and `TestExecution` so that data contracts are immutable across desktop and web.
  - *Acceptance Criteria*: All schemas defined in `packages/core/src/schemas.ts`; zero `any` types; unit tests pass.
* **US-1.2 (Multi-Theme System)**: As a user, I want 4 accessible themes (Obsidian Dark, Nordic Slate, Clean Paper, Warm Sand) meeting WCAG AAA contrast.
  - *Acceptance Criteria*: `ThemeProvider` supporting 4 themes with seamless switching; 0 visual flashing.
* **US-1.3 (Accessible Status Pills)**: As a color-blind tester, I want test statuses to combine color, an icon, and text so that state is unambiguous.
  - *Acceptance Criteria*: `StatusPill` component with emerald (Pass), rose (Fail), amber (Blocked), slate (Skip), and cyan (Auto).
* **US-1.4 (Command Palette `Cmd+K`)**: As a power user, I want a Raycast-style command palette to search and trigger actions without lifting my hands from the keyboard.
  - *Acceptance Criteria*: `Cmd+K` opens modal in < 10ms; keyboard navigable with arrow keys.

---

## Sprint 2: Local SQLite FTS5 Engine & Tauri v2 Shell (34 Story Points)
**Goal**: Implement the native desktop app with embedded SQLite and sub-5ms full-text search.

### User Stories:
* **US-2.1 (Tauri v2 Shell Initialization)**: As a desktop user, I want a lightweight native window on macOS/Windows/Linux with sub-200ms cold start.
  - *Acceptance Criteria*: Tauri v2 configured with least-privilege capability permissions; binary < 15MB.
* **US-2.2 (SQLite WAL & FTS5 Schema)**: As a tester, I want an embedded database that indexes 50,000 test cases with sub-5ms search speed.
  - *Acceptance Criteria*: `rusqlite` migrations for `test_cases`, `test_suites`, and `fts5_cases`; BM25 search queries verified.
* **US-2.3 (Type-Safe IPC Handlers)**: As a frontend engineer, I want type-safe Tauri IPC commands returning `Result<T, AppError>` without panics.
  - *Acceptance Criteria*: `list_cases`, `create_case`, `update_case`, `search_cases` commands implemented in Rust.

---

## Sprint 3: Interactive UI & Test Case Management (55 Story Points)
**Goal**: Deliver the 3-pane interactive interface with virtualized rendering and markdown authoring.

### User Stories:
* **US-3.1 (Suite Hierarchy Explorer)**: As a QA lead, I want a collapsible folder tree to organize test suites with drag-and-drop and pass-rate progress indicators.
  - *Acceptance Criteria*: Nested tree navigation; instant folder collapse/expand.
* **US-3.2 (Virtualized Test Case Grid)**: As a tester, I want to scroll through 50,000 test cases at 120 FPS without DOM lag.
  - *Acceptance Criteria*: TanStack Virtual / Glide Data Grid integration; DOM memory stays flat during scrolling.
* **US-3.3 (Notion-Style Step Editor)**: As a test author, I want inline markdown editing with `/step` shortcuts to define actions and expected results.
  - *Acceptance Criteria*: TipTap rich editor with sanitization via DOMPurify; auto-saving to local SQLite.
* **US-3.4 (Keyboard-First Execution)**: As a manual tester, I want to navigate with `J`/`K` and mark `P` (Pass), `F` (Fail), `S` (Skip) in 0ms with optimistic UI.
  - *Acceptance Criteria*: Zero spinner latency; status updates reflect immediately in UI and write asynchronously to SQLite.

---

## Sprint 4: Exploratory Testing & Floating Mini-HUD (34 Story Points)
**Goal**: Implement native desktop unfair advantages for exploratory manual testing.

### User Stories:
* **US-4.1 (Always-On-Top Mini HUD)**: As a manual tester, I want a compact floating window pinned over my target app so I can execute steps without Alt-Tabbing.
  - *Acceptance Criteria*: Tauri multi-window HUD with compact step instructions and hotkeys.
* **US-4.2 (Screenshot Capture & Annotation)**: As a tester logging a defect, I want to capture a screen clip, annotate it (arrow, red box, blur), and attach it to a failed step in seconds.
  - *Acceptance Criteria*: Clipboard paste (`Cmd+V`) with inline annotation toolbar; images saved to local `~/.kobean/media/`.

---

## Sprint 5: Localhost Web Server & CI/CD Ingestion CLI (34 Story Points)
**Goal**: Enable local web browser access and batch automation reporting.

### User Stories:
* **US-5.1 (Localhost Web Daemon on :4000)**: As a browser user, I want to open `http://localhost:4000` to manage tests with the same speed as the desktop app.
  - *Acceptance Criteria*: Embedded HTTP/WS server strictly bound to `127.0.0.1:4000`; serves React SPA.
* **US-5.2 (Streaming CI Batch Ingestion)**: As an automation engineer, I want CI test runners to push 10,000 test results in < 2 seconds.
  - *Acceptance Criteria*: `POST /api/v1/ci/ingest` supporting JUnit XML, Cucumber, and Playwright JSON with auto-case creation.
* **US-5.3 (@kobean/cli Test Runner)**: As a developer, I want a simple CLI tool to wrap local test commands: `npx kobean run --playwright "npx playwright test"`.
  - *Acceptance Criteria*: CLI binary parses runner output and submits payload to local daemon.

---

## Sprint 6: Hardening, Benchmarking & Packaging (21 Story Points)
**Goal**: Verify performance SLAs, security posture, and generate cross-platform installers.

### User Stories:
* **US-6.1 (Performance SLA Verification)**: Verify app cold start < 200ms, search latency < 5ms, and 120 FPS scrolling.
* **US-6.2 (Secret Leak & Security Audit)**: Full Betterleaks scan and IPC capability boundary audit.
* **US-6.3 (Cross-Platform Installers)**: Build `.dmg` (macOS Apple Silicon & Intel), `.msi` (Windows), and `.AppImage`/`.deb` (Linux).
