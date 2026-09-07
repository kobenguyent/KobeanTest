# KobeanTest — Master Plan Index

This repository uses a titanium-grade, pro-level engineering and planning architecture:

## 📋 Core Planning Documents

1. **[Master Implementation Plan](docs/planning/implementation-plan.md)**:
   - DDL Specifications (SQLite schema, FTS5 triggers, WAL mode)
   - Rust Tauri v2 IPC command contracts
   - Core TypeScript & Zod data models
   - Localhost REST & WebSocket API specifications
   - Detailed Phase 0 to Phase 6 breakdowns with Definition of Done (DoD)

2. **[Work Breakdown Structure (WBS) Dictionary](docs/planning/wbs-task-breakdown.md)**:
   - Complete hierarchical breakdown of all 233 story points across 7 Sprints
   - Micro-tasks with target file paths, dependencies (DAG), and complexity ratings

3. **[Failure Mode & Risk Mitigation Matrix (FMEA)](docs/planning/risk-mitigation-matrix.md)**:
   - 8 critical failure modes analyzed with Severity, Likelihood, Detection, and RPN scores
   - Concrete technical mitigations (WAL auto-checkpointing, port probing, quick-xml recovery, media quota)

4. **[Testing & Quality Assurance Verification Matrix](docs/planning/testing-and-verification-matrix.md)**:
   - 5-tier testing pyramid: Unit, SQLite FTS5 integration, UI Taste-Skill visual audit, CI ingestion benchmarks, and Playwright E2E
   - Quantitative performance SLA thresholds & automated verification commands

5. **[Scrum Sprint Backlog & Stories](docs/product/roadmap.md)**:
   - User stories (US-0.1 through US-6.3) with acceptance criteria and story point estimates

---

## 🏗️ Architecture & Decisions
* [System Overview & Architecture](docs/architecture/system-overview.md)
* [ADR-0001: Tauri v2 Desktop Shell](docs/architecture/adr/0001-tauri-v2-desktop-shell.md)
* [ADR-0002: SQLite FTS5 Localhost Storage](docs/architecture/adr/0002-sqlite-fts5-localhost.md)
* [ADR-0003: Embedded Localhost Web Server Daemon](docs/architecture/adr/0003-localhost-web-daemon.md)

---

## 📐 Product Specifications (PRDs)
* [PRD-01: Test Case Authoring & Management](docs/product/specs/prd-01-test-case-authoring.md)
* [PRD-02: Native Desktop Floating Mini-HUD](docs/product/specs/prd-02-floating-mini-runner.md)
* [PRD-03: CI/CD Batch Ingestion & Auto-Provisioning](docs/product/specs/prd-03-ci-batch-ingestion.md)

---

## 🎨 Design System & API
* [Design System Tokens & 4 Themes](docs/design-system/tokens.md)
* [OpenAPI 3.1 REST Specification](docs/api/openapi.yaml)
* [CI Test Ingestion Formats](docs/api/ingestion-formats.md)
