# Product Vision & Strategic Positioning — KobeanTest

## 1. Executive Summary

KobeanTest is a high-performance, minimalist, 100% localhost-first test management system built to liberate software engineering teams from the sluggish, bloated, and expensive legacy test management tools of the 2010s.

## 2. Competitive Landscape & The "Wedge"

| Dimension | Legacy Giants (TestRail) | Modern Cloud (Testomat.io / Qase) | **KobeanTest (Our Vision)** |
| :--- | :--- | :--- | :--- |
| **Data Privacy** | Cloud SaaS or Complex On-Prem Server | Cloud SaaS only | **100% Localhost & Air-Gapped (Zero Cloud)** |
| **Speed / Latency** | 800ms – 2,500ms full page reloads | ~200ms web API latency | **< 16ms (60–120 FPS) + Sub-5ms SQLite Search** |
| **Cost** | \$37 – \$70 / user / month | \$30 – \$50 / user / month | **$0.00 Forever (FOSS Permissive)** |
| **Desktop Integration** | None (Web only) | None (Web only) | **Native Tauri v2 Desktop + Floating Mini-HUD** |
| **Authoring DX** | 50 form fields, modal popup hell | Markdown / Gherkin | **Notion-style `/step` blocks, Vim keys, `Cmd+K`** |
| **Automated Testing** | Disconnected orphaned runs | Code-first decorators | **Universal Batch Ingest (JUnit/Playwright) + Auto-Provisioning** |

## 3. The Unfair Advantages

1. **The Floating Mini-HUD (Desktop)**:
   - Testers executing manual steps on a mobile simulator or desktop app can pin a 350px sleek HUD over their work, executing steps via hotkeys (`P`, `F`, `S`) without context switching or Alt-Tabbing.
2. **Local-First Speed (Linear of Test Management)**:
   - Built on an embedded SQLite database with FTS5 full-text search, operations happen at local NVMe SSD speeds without network spinners or loading bars.
3. **Total Data Sovereignty**:
   - For banks, defense, healthcare, and security-conscious engineering teams, KobeanTest guarantees that not a single byte of test data, reproduction notes, or internal staging URLs ever leaves the machine.
