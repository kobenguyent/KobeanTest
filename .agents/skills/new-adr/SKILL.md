---
name: new-adr
description: Automates drafting and numbering a new Architecture Decision Record in docs/architecture/adr/
---

# New ADR Workflow

When asked to create an Architecture Decision Record:
1. Inspect `docs/architecture/adr/` to find the highest number (e.g. `0003`).
2. Increment by 1 (`0004`).
3. Name the file `docs/architecture/adr/0004-<kebab-case-title>.md`.
4. Use the structure from `template.md` (Title, Status, Context, Decision, Consequences).
5. Document all trade-offs objectively.
