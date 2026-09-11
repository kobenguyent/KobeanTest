# Claude Code Configuration — KobeanTest

@AGENTS.md

## Claude Code Specific Notes
- Project MCP servers are configured in root `.mcp.json`.
- Tool permissions are scoped in `.claude/settings.json`.
- Canonical skills live in `.agents/skills/` with Claude adapters in `.claude/skills/`.

## Essential Commands
- Typecheck: `bun run typecheck`
- Test: `bun test`
- Desktop App: `bun run dev` (or `bun run tauri`)
- Secret scan: `bun run security:scan` (or `betterleaks git --staged --validation=false --config .betterleaks.toml`)
- Rust check: `cd apps/desktop/src-tauri && cargo check`
