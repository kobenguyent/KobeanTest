# Claude Code Quickstart — KobeanTest

You are working in the **KobeanTest** repository.
KobeanTest is a high-performance, 100% localhost-first test management desktop and web application (Tauri v2 + Rust + React 19 + SQLite FTS5).

## Authoritative Documentation & Rules
- **Universal Standards**: See `AGENTS.md`
- **Architecture & System Design**: See `docs/architecture/system-overview.md`
- **ADRs**: See `docs/architecture/adr/`
- **Domain Rules**: See `.agents/rules/`
- **Agent Workflows & Skills**: See `.agents/skills/`

## Key Commands
- Install dependencies: `pnpm install`
- Typecheck all packages: `pnpm typecheck`
- Run desktop app in development: `pnpm desktop:dev`
- Run web client in development: `pnpm web:dev`
- Run Rust checks: `cd apps/desktop/src-tauri && cargo check`
- Scan for secret leaks: `betterleaks scan --config .betterleaks.toml`
