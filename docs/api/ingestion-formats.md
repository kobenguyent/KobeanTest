# CI/CD Test Ingestion Formats & Framework Integrations — KobeanTest

KobeanTest accepts automated test results via its localhost HTTP daemon:
`POST http://127.0.0.1:4000/api/v1/projects/:project_id/ci/ingest`

All requests require bearer token authentication:
`Authorization: Bearer <session_token>` (read from `~/.kobean/session.json` or generated loopback token).

---

## 1. Universal CLI Test Runner (`kobean run`)

The fastest, zero-config way to run automated tests and stream results into KobeanTest without modifying test configs:

```bash
# Playwright
npx kobean run --playwright "npx playwright test"

# Cypress
npx kobean run --cypress "npx cypress run"

# Jest / Vitest
npx kobean run --jest "npm test"
npx kobean run --vitest "npx vitest run --reporter=json"

# Pytest
npx kobean run --pytest "pytest"

# Generic Command with custom format
npx kobean run --format junit --cmd "mvn test"
```

### CLI Features
- **Live Output Streaming**: Test framework `stdout` and `stderr` stream directly to the terminal in real time.
- **Exit Code Integrity**: The CLI preserves the child test runner's exact exit code for CI/CD compatibility.
- **Offline Tolerance**: If the local daemon is offline, a warning is printed to `stderr` without failing the test run.
- **Defect Screenshot Bundling**: Automatically converts test failure screenshots to base64 attachments.

---

## 2. Framework-Native Reporters

### Playwright (`@kobean/cli/playwright`)

Add to `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['@kobean/cli/playwright', { 
      uploadScreenshots: true,
      autoCreateCases: true
    }]
  ],
  use: {
    screenshot: 'only-on-failure'
  }
});
```

### Cypress (`@kobean/cli/cypress`)

Add to `cypress.config.ts`:

```typescript
import { defineConfig } from 'cypress';
import { kobeanCypressPlugin } from '@kobean/cli/cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      kobeanCypressPlugin(on, config);
    },
    screenshotOnRunFailure: true
  }
});
```

### Jest / Vitest (`@kobean/cli/jest`)

Add to `jest.config.js`:

```javascript
module.exports = {
  reporters: [
    'default',
    ['@kobean/cli/jest', { autoCreateCases: true }]
  ]
};
```

---

## 3. Kobean Batch JSON Payload Format

```json
{
  "idempotency_key": "github-run-10492-attempt-1",
  "run_name": "Local Playwright Run - Sprint 42",
  "commit_sha": "e4d3c2b1",
  "branch": "main",
  "environment": "local-macos",
  "auto_create_cases": true,
  "results": [
    {
      "automation_id": "tests/auth.spec.ts#login_valid_credentials",
      "title": "User can log in with valid credentials @LOC-1",
      "suite_path": ["Authentication", "Login"],
      "status": "passed",
      "duration_ms": 420,
      "attempt_number": 1,
      "tags": ["smoke", "LOC-1"]
    },
    {
      "automation_id": "tests/checkout.spec.ts#stripe_card_declined",
      "title": "Payment declines with expired test card @LOC-3",
      "suite_path": ["E2E", "Checkout", "Payments"],
      "status": "failed",
      "duration_ms": 1250,
      "attempt_number": 1,
      "error_message": "AssertionError: Expected banner 'Card Declined' but got '500 Server Error'",
      "stack_trace": "Error: at checkout.spec.ts:88:14",
      "tags": ["regression", "payments"],
      "attachments": [
        {
          "file_name": "failure-checkout.png",
          "mime_type": "image/png",
          "data_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "file_size_bytes": 68
        }
      ]
    }
  ]
}
```

### Key Payload Fields
- `suite_path`: Array of suite names representing directory or suite nesting (`["E2E", "Checkout", "Payments"]`). Automatically provisions parent-child suite relationships in SQLite.
- `tags`: Array of string tags (e.g. `["smoke", "LOC-1"]`).
- `attachments`: Array of test artifacts (screenshots, logs). Base64-encoded files are saved into `~/.kobean/media/` with POSIX `0600` permissions.

---

## 4. Tag-Based Automated Case Linking

To link automated tests directly to authored manual test cases without creating duplicate entries:
- Include `@<PROJECT_KEY>-<number>` in test titles or scenario tags (e.g., `@LOC-1`, `@KB-42`).
- The ingestion engine resolves the tag against the active project's case key and automatically assigns `case_id` to link the run execution.

---

## 5. Supported Report File Formats

### Playwright JSON (`playwright-report.json`)
```bash
npx kobean report --playwright playwright-report.json
```
Ingests spec files, nested test suites, step outcomes, error messages, and embeds failure screenshots.

### Cucumber JSON (`cucumber-report.json`)
```bash
npx kobean report --cucumber cucumber-report.json
```
Ingests feature files as root suites, scenarios as test cases, computes total step durations, and parses scenario tags for `@<KEY>-<number>` links.

### Standard JUnit XML
```bash
npx kobean report --junit junit-results.xml
```
Supports standard `<testsuites>`, `<testsuite name="...">`, and `<testcase>` hierarchies generated by Pytest, Maven Surefire, Vitest, and Jest.
