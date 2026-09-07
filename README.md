# KobeanTest

> **100% Localhost-First Next-Generation Test Management System**  
> Built for engineers, QA leads, and SDETs who value sub-16ms speed, total data privacy, and keyboard-driven efficiency.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS | Windows | Linux](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-emerald.svg)](#)
[![Stack: Tauri v2 + React 19 + Rust + SQLite](https://img.shields.io/badge/Stack-Tauri%20v2%20%7C%20React%2019%20%7C%20Rust%20%7C%20SQLite-indigo.svg)](#)

---

## Highlights & Features

* 🔒 **100% Localhost & Air-Gapped**: Zero cloud database dependencies. All data (test cases, runs, execution notes, screenshots) lives strictly on your local NVMe SSD (`127.0.0.1`).
* ⚡ **Speed as Feature #1**: Sub-16ms (60–120 FPS) UI responsiveness, optimistic UI updates, and sub-5ms local SQLite FTS5 full-text search.
* 🖥️ **Desktop Native + Localhost Web**: Run as a native Tauri v2 desktop app (macOS, Windows, Linux) or access via your local browser on `http://127.0.0.1:4000`.
* ✍️ **Notion-Style Markdown Step Editor**: Inline `/step`, `/table`, and `/gherkin` blocks with instant auto-save and versioning. No modal popup hell.
* 🎮 **The Floating Mini-HUD (Desktop)**: Always-on-top compact runner widget that pins above mobile simulators or browser targets, allowing rapid `P` (Pass), `F` (Fail), and `S` (Skip) execution.
* 🤖 **Universal CI/CD Automation Ingestion**: Batch stream 10,000+ test results in < 2 seconds from Playwright, Cypress, Pytest, or JUnit XML with automatic test case provisioning.
* 🎨 **Linear-Grade Aesthetics**: 4 curated themes (Obsidian Dark, Clean Paper, Nordic Slate, Warm Sand), 1.75px Lucide icons, and WCAG AAA color-blind accessibility.

---

## Project Structure & Documentation

```text
KobeanTest/
├── AGENTS.md                          # 🤖 Master AI Agent Instructions & Context Router
├── CLAUDE.md                          # ⚡ Claude Code Quickstart
│
├── .agents/                           # 🧠 Universal AI Knowledge Base
│   ├── rules/                         # Modular domain rules (Ponytail, Superpowers, Taste)
│   ├── personas/                      # Specialized agent personas (Architect, SDET, Designer)
│   └── skills/                        # Automated agent skills (/new-adr, /taste-skill)
│
├── .cursor/                           # 🎯 Cursor Rules (.mdc scoped files)
├── .claude/                           # 🤖 Claude Code settings and permissions
├── .beads/                            # 📿 Git-tracked agent task dependency graph
├── .betterleaks.toml                  # 🔒 Zero-leak secret scanning configuration
│
├── docs/                              # 📚 Comprehensive Documentation
│   ├── architecture/                  # System design, local SQLite, and ADRs (0001–0003)
│   ├── product/                       # Vision, Strategy, Roadmap, and Feature PRDs (01–03)
│   ├── design-system/                 # Typography, 4 themes, status tokens
│   └── api/                           # OpenAPI 3.1 schema & CI ingestion specs
│
├── apps/                              # 🖥️ Desktop (Tauri v2) & Web SPA
└── packages/                          # 📦 Core types, UI design system, Server daemon, CLI
```

---

## Engineering Guidelines & AI Instructions

Before modifying code, all engineers and AI assistants must read the authoritative rules:
* [AGENTS.md](AGENTS.md): Master coding principles and definition of done.
* [Ponytail Minimalism](.agents/rules/ponytail-minimalism.md): The "lazy senior developer" anti-overengineering ladder.
* [Superpowers Discipline](.agents/rules/superpowers-tdd.md): Strict TDD and verification state machine.
* [Taste-Skill Principles](.agents/rules/ui-taste-principles.md): Eliminating AI UI slop; 1px borders and typography rules.
* [Roadmap & Sprints](docs/product/roadmap.md): Scrum backlog and sprint stories.

---

## License

MIT License — 100% Free and Open-Source Software (FOSS).
