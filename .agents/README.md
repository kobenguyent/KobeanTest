# The .agents Directory — Unified Agent Knowledge Base

This directory is the tool-agnostic, single source of truth for all AI coding agents working on **KobeanTest**.

```text
.agents/
├── rules/         # Canonical modular domain rules
├── personas/      # Human/AI role reference profiles for review framing
└── skills/        # Canonical reusable workflows (/slash-commands)
```

## Directory Registry

### 1. `rules/` (Canonical Domain Rules)
- `core-principles.md`: 100% Localhost, 16ms SLA, $0 FOSS permissive licensing.
- `ponytail-minimalism.md`: The "lazy senior developer" decision ladder (anti-overengineering).
- `superpowers-tdd.md`: Disciplined development lifecycle (spec-first -> TDD -> minimal code -> review).
- `ui-taste-principles.md`: Eliminating AI UI slop; 1px borders, typography, optical balance.
- `rust-tauri.md`: Tauri v2 Rust safety, `#![deny(clippy::unwrap_used)]`, capability allowlists.
- `typescript.md`: Strict mode, zero `any`, Zod schema-first contracts.
- `security-isolation.md`: IPC capability sandboxing, local SQLite security, DOMPurify.

### 2. `personas/` (Reference Personas)
These documents serve as reference persona definitions for prompt framing and specialized domain reviews:
- `cto-architect.md`: Architecture trade-offs, ADR compliance, system maintainability.
- `principal-sdet.md`: CI/CD ingestion, Playwright/JUnit runner integrations, test data integrity.
- `security-auditor.md`: Secret audits, local storage permissions, input sanitization.
- `ui-ux-designer.md`: Information density, keyboard workflows, WCAG AAA accessibility.

### 3. `skills/` (Canonical Reusable Skills)
- `new-adr/`: Automates drafting and numbering new ADRs in `docs/architecture/adr/`.
- `taste-skill/`: Runs the 7-point visual taste self-audit on new UI components.
- `benchmark-ingest/`: Validates that CI batch ingestion meets the < 2.0s throughput SLA over disposable datasets.
