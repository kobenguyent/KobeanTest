# KobeanTest — Testing & Quality Assurance Verification Matrix

> **Author**: Principal QA Engineer & Lead SDET  
> **Target**: Comprehensive Automated & Manual Quality Gates

---

## 1. Quality Pyramid Architecture

```text
       ▲
      / \        E2E Tests (Playwright: Desktop & Localhost Web flows)
     /───\       Integration & IPC Tests (Tauri Rust IPC + SQLite Transactions)
    /─────\      Component & Visual Taste Tests (Vitest + React Testing Library)
   /───────\     Unit Tests (Zod Schema Validation, FTS5 BM25 search, CLI parser)
  ───────────
```

---

## 2. Test Suite Breakdown

### Tier 1: Unit & Schema Validation (`packages/core`)
* **Framework**: Vitest.
* **Scope**:
  - `TestCaseSchema`: Validates UUIDs, step array bounds, priority enums, and required fields.
  - `TestStepSchema`: Rejects empty actions or empty expected results.
  - `StatusMapping`: Verifies that every status has an icon, a color token, and a text label.
* **Gate**: `pnpm --filter @kobean/core test` must pass with 100% statement coverage.

---

### Tier 2: SQLite & Rust Core Integration Tests (`apps/desktop/src-tauri`)
* **Framework**: `cargo test`.
* **Scope**:
  1. **Schema Migration Test**: Creates fresh in-memory SQLite database, runs migrations, verifies tables and indexes exist.
  2. **FTS5 Full-Text Search Benchmark**:
     - Inserts 10,000 generated test cases into SQLite.
     - Runs 100 random full-text search queries (e.g. `title: "auth"`, `preconditions: "cookie"`).
     - **Assertion**: 95th percentile query latency must be `< 3.0ms`.
  3. **Concurrency Stress Test**:
     - Spawns 10 concurrent threads: 8 readers executing FTS5 queries, 2 writers appending test execution results.
     - **Assertion**: Zero `SQLITE_BUSY` errors; zero database corruption.
  4. **WAL Checkpoint Test**:
     - Executes 5,000 inserts, forces `PRAGMA wal_checkpoint(TRUNCATE)`, verifies `-wal` file shrinks to 0 bytes.

---

### Tier 3: UI Component & Taste-Skill Visual Audit (`packages/ui`)
* **Framework**: Vitest + Testing Library.
* **Scope**:
  - `StatusPill`: Verifies proper semantic class injection and color-blind text rendering.
  - `CommandPalette`: Verifies `Cmd + K` keyboard event listener and item selection via arrow keys.
  - `ThemeProvider`: Verifies all 4 themes apply proper CSS variables without class flickering.
* **Visual Audit Gate**: Every component must pass the 7 items in `.agents/skills/taste-skill/visual-audit.md`.

---

### Tier 4: CI Ingestion Benchmark (`packages/server` / Daemon)
* **Scope**:
  - Generates a 10,000 test case JUnit XML report and a Kobean Batch JSON payload.
  - Submits payload to `POST http://127.0.0.1:4000/api/v1/ci/ingest`.
  - **Assertions**:
    - HTTP response code is `200 OK`.
    - Total processing time is `< 2,000ms`.
    - All 10,000 records exist in `test_executions`.
    - Auto-provisioning successfully created missing test cases in `test_cases`.

---

### Tier 5: End-to-End Workflow Verification (Playwright)
* **Test Flow 1: Test Case Authoring**:
  1. Launch app at `http://127.0.0.1:4000`.
  2. Click `+ New Case` or press `C`.
  3. Type title: `"Biometric Authentication with FaceID"`.
  4. Type `/step` in editor -> Enter Action: `"Tap Sign In"`, Expected: `"FaceID prompt appears"`.
  5. Press `Cmd + Enter` -> Verify case saved to list in `< 10ms`.
* **Test Flow 2: Live Keyboard Execution**:
  1. Open active test run.
  2. Press `J` to select case.
  3. Press `P` -> Verify badge pulses emerald and marks "Passed" in 0ms.
  4. Press `J` -> Press `F` -> Type note: `"Button unresponsive"` -> Submit.
  5. Verify progress ring advances from `1/2` to `2/2`.

---

## 3. Automated Verification Matrix

| Verification Check | Target SLA | Command | Blocking Gate |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | 0 errors | `pnpm typecheck` | Pre-commit & CI |
| **Rust Safety Audit** | 0 panics / unwraps | `cargo clippy -- -D warnings` | Pre-commit & CI |
| **Secret Scan** | 0 leaked credentials | `betterleaks scan --config .betterleaks.toml` | Pre-commit |
| **Core Unit Tests** | 100% pass | `pnpm test` | Pre-commit |
| **FTS5 10k Search Latency** | `< 5.0ms` | `cargo test --bench bench_fts5` | Phase 2 Gate |
| **CI Ingestion Throughput** | `< 2.0s` (10k cases)| `pnpm benchmark:ingest` | Phase 5 Gate |
