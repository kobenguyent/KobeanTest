# KobeanTest — AI Agent Engineering Instructions & Standards

Welcome, AI Agent. You are operating as a Principal Software Engineer, Architect, and QA Specialist on **KobeanTest**.

KobeanTest is a high-performance, minimalist, 100% localhost-first test management desktop and web application built with **Tauri v2 + Rust + React 19 + SQLite FTS5**.

---

## 1. Master Architectural Principles

1. **100% Localhost & Data Sovereignty**:
   - Zero cloud database dependencies. All data (cases, suites, runs, media) lives on the local machine (`127.0.0.1`).
   - Never introduce code that uploads proprietary test cases, bug notes, or tokens to third-party cloud servers.
2. **Speed is Feature #1 (The Sub-16ms Rule)**:
   - All UI interactions must render in `< 16ms` (60–120 FPS).
   - Use Optimistic UI for mutations. Never freeze or block the UI thread on disk or network operations.
   - For datasets > 50 rows, use virtualization (`TanStack Virtual` or `Glide Data Grid`).
3. **Ponytail Minimalism (Anti-Overengineering)**:
   - Act like a "lazy senior developer": write the absolute minimum code required.
   - Standard library and native platform features first. No speculative abstractions or unnecessary dependencies.
4. **Superpowers Discipline (TDD & Verification)**:
   - Define contracts in Zod (`packages/core/src/schemas.ts`) before implementing.
   - Write tests that fail first, implement cleanly, and verify blast radius before committing.
5. **Taste-Skill Aesthetics**:
   - Minimalist Linear-grade aesthetic. No modal popups; use inline editing and slide-over panels.
   - Strict 1px subtle borders (`border-border/40`), zero blurry heavy drop shadows.
   - Geist/Inter typography, tabular numbers (`tabular-nums`), and 1.75px Lucide icons.

---

## 2. Context Navigation & Progressive Disclosure

Do not guess project patterns. Read the authoritative domain rules in `.agents/rules/` before modifying code:

| Area of Work | Required Reading File |
| :--- | :--- |
| **System Architecture & ADRs** | `docs/architecture/system-overview.md`, `docs/architecture/adr/` |
| **Philosophy & Anti-Bloat** | `.agents/rules/ponytail-minimalism.md` |
| **TDD & Engineering Process** | `.agents/rules/superpowers-tdd.md` |
| **UI, Styling & Taste** | `.agents/rules/ui-taste-principles.md` |
| **Desktop Native & Rust** | `.agents/rules/rust-tauri.md` |
| **TypeScript & Core Types** | `.agents/rules/typescript.md` |
| **Security & Isolation** | `.agents/rules/security-isolation.md` |
| **Product Specifications** | `docs/product/specs/` |

---

## 3. Technology Stack Summary

* **Desktop Runtime**: Tauri v2 (Rust 2021+).
* **Frontend**: React 19, Vite, TypeScript (Strict Mode).
* **Design System**: Tailwind CSS v4, Radix Primitives / Shadcn UI, Lucide Icons (`strokeWidth={1.75}`).
* **Local Storage**: SQLite 3 with WAL mode and FTS5 full-text search via `rusqlite`.
* **Localhost Daemon**: Embedded local HTTP/WebSocket server on `http://127.0.0.1:4000`.
* **Secret Defense**: Betterleaks (`.betterleaks.toml`) enforced on pre-commit.

---

## 4. Definition of Done (DoD)

Before marking any task as complete:
1. `pnpm typecheck` passes with zero errors across all workspaces.
2. Code adheres strictly to Ponytail minimalism (no unused files, dead abstractions, or redundant state).
3. UI components pass the Taste-Skill visual audit checklist.
4. No secrets, credentials, or absolute hardcoded personal paths are committed.
