# Product Vision & Strategic Positioning — KobeanTest

## 1. Executive Summary

KobeanTest is a high-performance, minimalist, 100% localhost-first test management system built to liberate software engineering teams from sluggish, bloated, and complex enterprise test management setups.

## 2. Competitive Landscape & The "Wedge"

| Dimension | Legacy Enterprise (TestRail) | Modern Agility (Testomat.io) | **KobeanTest (Our Vision)** |
| :--- | :--- | :--- | :--- |
| **Deployment Model** | Cloud SaaS or Heavy Server (PHP/Docker) | Cloud SaaS or On-Premises Edition | **100% Zero-Server Localhost (Single Binary + SQLite)** |
| **Setup & Dependencies** | Database, web server, background workers | Cloud account or on-prem cluster setup | **Zero external setup. Run binary, works in 150ms.** |
| **Speed / Latency** | 800ms – 2,500ms full page reloads | ~200ms web API latency | **< 16ms (60–120 FPS) + Sub-5ms SQLite Search** |
| **Cost** | \$37 – \$70 / user / month | \$30 – \$50 / user / month | **$0.00 Forever (FOSS Permissive)** |
| **Desktop Integration** | None (Web only) | None (Web only) | **Native Tauri v2 Desktop + Floating Mini-HUD** |
| **Authoring DX** | 50 form fields, modal popup hell | Markdown / Gherkin | **Notion-style `/step` blocks, Vim keys, `Cmd+K`** |
| **Automated Testing** | Disconnected orphaned runs | Bi-directional code-first sync | **Idempotent Batch Ingest (JUnit/JSON) + Auto-Provisioning** |

## 3. The Unfair Advantages

1. **Zero-Setup Localhost Simplicity**:
   - Other tools require managing Docker containers, background queues, and database engines even for on-premises use. KobeanTest runs completely out of a single native binary with embedded SQLite FTS5—zero ops overhead.
2. **The Floating Mini-HUD (Desktop)**:
   - Testers executing manual steps on a mobile simulator or desktop app can pin a 360px sleek HUD over their work, executing steps via hotkeys (`P`, `F`, `S`) without context switching or Alt-Tabbing.
3. **True Local-First Speed (Linear of Test Management)**:
   - Built on an embedded SQLite database with FTS5 full-text search, operations happen at local NVMe SSD speeds without network spinners or loading bars.
4. **Air-Gapped Data Sovereignty**:
   - For banks, defense, healthcare, and security-conscious engineering teams, KobeanTest guarantees that not a single byte of test data, reproduction notes, or internal staging URLs ever leaves the machine.
