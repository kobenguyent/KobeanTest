# KobeanTest — Documentation Hub

Welcome to the comprehensive documentation for **KobeanTest**, the next-generation, 100% localhost-first test management desktop and web application.

---

## 🚀 Quick Links

* [**Getting Started Guide**](getting-started.md): Installation, running the app, triage shortcuts, Mini-HUD, and CI ingestion.
* [**System Architecture & C4 Flow**](architecture/system-overview.md): Localhost topology, SQLite WAL persistence, and data flow.
* [**Scrum Backlog & Product Roadmap**](product/roadmap.md): Completed epics, deliverables, and user stories.
* [**Design System Tokens**](design-system/tokens.md): Typography (Geist/Inter), 4 WCAG AAA themes, and StatusPill specifications.
* [**CI Ingestion Formats**](api/ingestion-formats.md): JUnit XML, Cucumber, and Playwright JSON ingestion payload formats.

---

## Complete Documentation Index

```text
docs/
├── getting-started.md         # 🚀 Step-by-step guide: installation, running, shortcuts, CI
│
├── architecture/              # Technical system design, local storage, and ADRs
│   ├── system-overview.md     # C4 architecture and localhost data flow
│   └── adr/                   # Architecture Decision Records
│       ├── 0001-tauri-v2-desktop-shell.md
│       ├── 0002-sqlite-fts5-localhost.md
│       └── 0003-localhost-web-daemon.md
│
├── product/                   # Product requirements, personas, and roadmaps
│   ├── vision-and-strategy.md # Product vision, positioning vs TestRail, $0 FOSS
│   ├── roadmap.md             # Sprints 0–6 roadmap and delivery tracking
│   └── specs/                 # Feature PRDs
│       ├── prd-01-test-case-authoring.md
│       ├── prd-02-floating-mini-runner.md
│       └── prd-03-ci-batch-ingestion.md
│
├── design-system/             # UI tokens, typography, themes & accessibility
│   └── tokens.md              # 4 WCAG AAA themes, spacing, and 1.75px Lucide icons
│
├── planning/                  # Engineering plans & quality matrices
│   ├── wbs-task-breakdown.md  # 233-point outcome deliverables breakdown
│   ├── risk-mitigation-matrix.md
│   └── testing-and-verification-matrix.md
│
└── api/                       # API definitions & ingestion schemas
    ├── openapi.yaml           # OpenAPI 3.1 schema for localhost daemon
    └── ingestion-formats.md   # Batch CI payload specifications
```
