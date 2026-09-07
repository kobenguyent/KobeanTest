# PRD-03: CI/CD Batch Ingestion & Auto-Provisioning

## 1. Overview
Automated test frameworks (Playwright, Cypress, Pytest, Jest, Vitest) generate hundreds or thousands of test results per run. KobeanTest provides a high-throughput streaming ingestion pipeline that records these results locally and auto-creates test cases on the fly.

## 2. Requirements

### Functional Requirements
1. **Universal Batch Ingestion Endpoint**:
   - `POST /api/v1/ci/ingest`
   - Accepts:
     - Kobean Batch JSON (lean native format).
     - Standard JUnit XML (`multipart/form-data` or XML payload).
     - Cucumber JSON (BDD steps with execution status).
2. **Auto-Case Provisioning (`auto_create_cases: true`)**:
   - Matches incoming tests by `automation_id` (e.g. `tests/auth.spec.ts#login_success`).
   - If an `automation_id` does not exist in SQLite, KobeanTest automatically:
     1. Creates the matching Suite hierarchy based on file path or suite tags.
     2. Creates the `TestCase` entry.
     3. Records the `TestExecution` under the active `TestRun`.
3. **Flaky Test Detection Engine**:
   - Calculates historical volatility over the last 30 runs for each `automation_id`.
   - Flags tests that alternate between Passed and Failed on the same commit or environment as `is_flaky: true`.
4. **CLI Wrapper (`@kobean/cli`)**:
   - Single command execution:
     ```bash
     npx kobean run --playwright "npx playwright test"
     npx kobean report --format junit --path "./results/*.xml"
     ```

## 3. Non-Functional Requirements
- Process and persist 10,000 test results in under 2.0 seconds into local SQLite.
- Streaming parser uses chunked batch transactions to prevent database locks.
