# Claude Code Configuration — KobeanTest

@AGENTS.md

## Claude Code Specific Notes
- Project MCP servers are configured in root `.mcp.json`.
- Tool permissions are scoped in `.claude/settings.json`.
- Canonical skills live in `.agents/skills/` with Claude adapters in `.claude/skills/`.

## Essential Commands
- Typecheck: `pnpm run typecheck`
- Secret scan: `betterleaks git --staged --validation=false --config .betterleaks.toml`
- Rust check: `cd apps/desktop/src-tauri && cargo check` (once Phase 2 is scaffolded)
