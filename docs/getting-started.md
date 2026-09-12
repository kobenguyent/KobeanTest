# KobeanTest — Getting Started Guide

KobeanTest is a high-performance, minimalist, 100% localhost-first test management desktop and web application built with **Tauri v2 + Rust + React 19 + SQLite FTS5**.

---

## 1. Prerequisites

Before running KobeanTest, verify that your local machine has the standard developer toolchains installed:

* **Bun**: `v1.3+` (`bun -v`)
* **Rust**: `1.85+` stable with Cargo (`cargo -V`)
* **Operating System**: macOS (Apple Silicon or Intel), Windows 10/11, or Linux (Ubuntu 22.04+)

All test data, media attachments, full-text indexes, and credentials live strictly on your local machine (`127.0.0.1`) under `~/.kobean/`. Zero cloud databases, zero telemetry.

---

## 2. Quick Start: Launching KobeanTest

### Option A: Launch the Desktop Application (Recommended)

To compile and launch the complete application with a single command:

```bash
bun run dev
# or
bun run tauri
```

When started, KobeanTest automatically:
1. Initializes SQLite in Write-Ahead Logging (WAL) mode under `~/.kobean/kobean.db` (file permissions `0600`).
2. Generates the FTS5 Porter stemmer full-text search indexes.
3. Creates the local media storage directory `~/.kobean/media/` (directory permissions `0700`).
4. Generates a secure loopback session token in `~/.kobean/session.json` (permissions `0600`).
5. Binds the embedded daemon to `http://127.0.0.1:4000`.
6. Automatically launches the KobeanTest UI at **`http://127.0.0.1:4000`** in your desktop environment.

### Option B: Compiling & Running the Standalone Native Binary (2.7 MB)

To build the self-contained, optimized native release binary:

```bash
# Build the native release binary:
bun run build:rust

# Run the compiled native executable directly:
./apps/desktop/src-tauri/target/release/kobean-desktop
```

### Option C: Headless Mode (Background CI / Automation)

If running in automated CI/CD pipelines or headless servers where a desktop browser should not open automatically:

```bash
cd apps/desktop/src-tauri && cargo run -- --headless
```

---

## 3. Using the Interactive Three-Pane UI

KobeanTest is designed for keyboard-driven efficiency with **sub-16ms** UI responsiveness (60–120 FPS):

![KobeanTest three-pane workspace](assets/screenshots/app-overview.png)

### 1. Suite Tree Explorer (Left Pane)
- Organize tests hierarchically with nested folders and test case count badges.
- Click `+ New Suite` to add modules or features.
- Cycle protection is enforced by database schema constraints (`CHECK parent_id != id`).

### 2. High-Density Test Case Grid (Center Pane)
- Filter test cases by priority (`critical`, `high`, `medium`, `low`) and type (`manual`, `automated`, `exploratory`).
- Filter cases instantly using the live search bar or fuzzy command palette.
- Navigate rows without lifting hands from keyboard:
  - <kbd>J</kbd> or <kbd>↓</kbd>: Move down to next test case.
  - <kbd>K</kbd> or <kbd>↑</kbd>: Move up to previous test case.
  - <kbd>Enter</kbd>: Open test case in slide-over pane.

### 3. Step Editor Slide-Over (Right Pane)
- Inspect test case preconditions, automation IDs, and version history (`v1`, `v2`, etc.).
- Inline structured step editor with **Action** and **Expected Result**.
- Reorder steps, add steps, or delete steps inline without modal popup wizards.

### 4. Raycast-Grade Command Palette (<kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd>)
- Press <kbd>⌘K</kbd> anywhere in the application to open the quick action palette.
- Instantly search all test cases, create cases, or trigger test runs.

![KobeanTest command palette](assets/screenshots/command-palette.png)

---

## 5. Test Run Execution & Zero-Latency Triage

Click **"▶ Run Tests"** or switch to **"Execution Run"** mode in the top header:

![KobeanTest execution run view](assets/screenshots/execution-run.png)

1. **0ms Optimistic Keyboard Triage**:
   - <kbd>P</kbd>: Mark test **Passed** and advance.
   - <kbd>F</kbd>: Mark test **Failed** and capture failure notes.
   - <kbd>B</kbd>: Mark test **Blocked**.
   - <kbd>S</kbd>: Mark test **Skipped**.
   - <kbd>J</kbd> / <kbd>K</kbd>: Navigate through test items.
   - *Note: Hotkeys are window-scoped and automatically disabled inside text input fields.*
2. **Live Aggregates**:
   - The top progress bar and accessible `StatusPill` badges update instantaneously on every triage action.

---

## 6. Screenshot Snapping & Image Annotation Canvas

Attach defect evidence to any failed execution step in seconds:

1. **Direct Clipboard Paste (<kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>)**:
   - Press <kbd>⌘V</kbd> while viewing an execution, or click the **"📸 Snap / Paste"** button.
   - The interactive annotation modal automatically opens.
2. **Annotation Toolbar**:
   - 🟥 **Rectangle**: Highlight the broken UI element or misaligned layout.
   - ➡️ **Defect Arrow**: Point directly to the defect.
   - 🔲 **Redact / Blur**: Blackout sensitive user tokens, passwords, or PII.
   - 🔤 **Text Callout**: Add defect descriptions directly onto the screenshot.
   - 🎨 **Palette**: Red, Amber, Emerald, Cyan, White.
3. **Save & Attach**:
   - Click **"Attach to Execution"**.
   - The image is saved locally to `~/.kobean/media/` with strict permissions and registered in the test run.
   - A 10GB LRU storage quota automatically evicts oldest test attachments if disk space reaches the limit.

---

## 7. The Floating Mini-HUD (Exploratory Testing)

When testing external mobile simulators, emulators, or web apps, Alt-Tabbing breaks focus:

1. Click **"🪟 Float HUD"** in the top navigation bar.
2. An always-on-top compact runner widget (360x220px) appears pinned above all other windows.
3. Displays the current test case ID, title, active step action, and expected result.
4. Execute tests directly from the widget with <kbd>P</kbd>, <kbd>F</kbd>, <kbd>S</kbd>, <kbd>[</kbd>, and <kbd>]</kbd>.
5. Synchronizes bidirectionally with the main window in `< 1ms` via native `BroadcastChannel('kobean_hud_sync')`.

![KobeanTest floating mini-hud](assets/screenshots/mini-hud.png)

---

## 8. Automated CI/CD Results Ingestion (`@kobean/cli`)

Submit 10,000+ test results from your CI pipelines (GitHub Actions, GitLab CI, local scripts) in `< 2 seconds`:

### Step 1: Discover Daemon Status
```bash
bun run kobean status
# or directly:
./packages/cli/src/index.ts status
```
Output:
```text
✓ Kobean daemon is online at http://127.0.0.1:4000
  Token discovered in ~/.kobean/session.json
```

### Step 2: Ingest Test Reports
```bash
bun run kobean report \
  --project <project_id> \
  --file ./reports/junit.xml \
  --name "CI Pipeline Run #101"
```

The CLI uses a zero-dependency, regex-based JUnit XML and JSON parser that automatically:
- Extracts test titles, classnames, execution durations, failure messages, attachments, and stack traces.
- Auto-provisions new test cases matching the `automation_id` if they do not yet exist.
- Prevents duplicate runs using network `idempotency_key` headers.

---

## 9. Verification, Tests & Performance Benchmarks

### Run Monorepo Unit Tests
```bash
bun test
```
*Executes all 35 tests across `@kobean/core`, `@kobean/ui`, `@kobean/cli`, and `@kobean/desktop` in ~140ms.*

### Run Strict TypeScript Typecheck
```bash
bun run typecheck
```

### Run Rust Core Integration Tests
```bash
bun run test:rust
```
*Executes all Rust integration test suites (WAL migrations, composite FKs, atomic backup, media manager, HTTP daemon).*

### Run Automated SLA Performance Benchmarks
```bash
bun run benchmark
```
*Verifies strict SLAs against SQLite:*
- **FTS5 Porter Full-Text Search**: `< 5.0ms` SLA (Measured: **`1.86ms`**).
- **10,000 CI Cases Batch Ingestion**: `< 2,000ms` SLA (Measured: **`1,419ms`** at **7,042 cases/sec**).

### Run Zero-Panic & Secret Scanners
```bash
# Verify zero .unwrap() or .expect() in production Rust
bun run lint:clippy

# Verify zero secrets or API tokens staged
bun run security:scan
```
