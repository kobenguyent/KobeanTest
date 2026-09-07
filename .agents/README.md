# The .agents Directory — Unified Agent Knowledge Base

This directory is the tool-agnostic, single source of truth for all AI coding agents working on **KobeanTest**.

```text
.agents/
├── rules/         # Modular domain rules (auto-attached or referenced by context)
├── personas/      # Specialized engineering personas for multi-agent delegation
├── skills/        # Reusable agent skills and automated slash-workflows
└── workflows/     # Standard operating procedures for release, migration & adapters
```

## Directory Registry

### 1. `rules/`
- `core-principles.md`: 100% Localhost, 16ms performance, zero-license open-source.
- `ponytail-minimalism.md`: The "lazy senior developer" decision ladder (anti-overengineering).
- `superpowers-tdd.md`: Disciplined development lifecycle (brainstorm -> plan -> TDD -> execute -> review).
- `ui-taste-principles.md`: Eliminating AI UI slop; 1px borders, typography, optical balance.
- `rust-tauri.md`: Tauri v2 Rust safety, zero-unwrap, capabilities allowlist.
- `typescript.md`: Strict mode, zero `any`, Zod schema-first contracts.
- `security-isolation.md`: IPC capability sandboxing, local SQLite security, DOMPurify.

### 2. `personas/`
- `cto-architect.md`: Architectural decision enforcement and trade-off analysis.
- `principal-sdet.md`: CI/CD ingestion, Playwright/JUnit runner integrations.
- `security-auditor.md`: Secret audits, local storage permissions, input sanitization.
- `ui-ux-designer.md`: Information density, keyboard workflows, theme accessibility.

### 3. `skills/`
- `new-adr/`: Automates drafting and numbering new ADRs in `docs/architecture/adr/`.
- `taste-skill/`: Runs the 7-point visual taste self-audit on new UI components.
- `benchmark-ingest/`: Validates that CI batch ingestion meets the < 500ms throughput SLA.
