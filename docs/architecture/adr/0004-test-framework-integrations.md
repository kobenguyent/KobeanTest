# ADR-0004: Test Framework Integrations & High-Throughput Batch Ingestion

## Status
Accepted

## Context
Automated testing teams utilize diverse testing frameworks across modern stacks—primarily Playwright, Cypress, Jest/Vitest for TypeScript/JavaScript, Pytest for Python, and Cucumber for BDD workflows. To provide a unified QA source of truth, KobeanTest requires seamless automated ingestion of test results, execution durations, hierarchical suite structures, failure logs, and defect screenshots without requiring cloud accounts, proprietary agent daemons, or modifying existing CI pipeline exit codes.

## Decision
We implement a unified, dual-tier test framework integration architecture:

1. **Dual Integration Interface**:
   - **Zero-Config Universal CLI Runner (`kobean run`)**: Wraps test suite execution commands (`--playwright`, `--cypress`, `--jest`, `--vitest`, `--pytest`, or custom `--cmd`), captures outputs and report artifacts, and delivers results in one pass.
   - **Framework-Native Reporters**: First-class reporter plugins (`@kobean/cli/playwright`, `@kobean/cli/cypress`, `@kobean/cli/jest`) hooking into native framework event lifecycles.

2. **Zero-Dependency Lightweight Parsers**:
   - Built-in Node.js parsers for Playwright JSON, Cucumber JSON, and JUnit XML (`@kobean/cli/src/parsers/*`), eliminating heavy third-party parsing dependencies.

3. **Dynamic Suite Hierarchy Auto-Provisioning**:
   - In SQLite, `find_or_create_suite_path` recursively traverses and provisions hierarchical test suite trees based on spec directories or suite paths (e.g. `checkout.spec.ts` -> `Payment Flow`), automatically assigning `parent_id` foreign keys with cycle prevention.

4. **Tag-Based Automated Case Linking**:
   - Test titles and scenario tags matching `@<PROJECT_KEY>-<number>` (e.g., `@LOC-3`) are resolved against the active project's case numbering scheme, automatically linking automated executions to authored test specifications.

5. **Local Defect Attachment Ingestion**:
   - Test failure screenshots (base64-encoded) are decoded and saved directly into `~/.kobean/media/` with POSIX `0600` permissions (owner read/write only) and linked to execution results in `execution_attachments`.

6. **Non-Blocking Offline Tolerance & Exit Code Preservation**:
   - If the KobeanTest localhost daemon is offline or unreachable (`ECONNREFUSED`), reporters and the CLI runner emit non-blocking warnings to `stderr` and preserve the child process's exact exit code, ensuring CI/CD pipelines never fail due to local test management downtime.

## Consequences

### Positive
- Universal coverage for Playwright, Cypress, Jest, Vitest, Pytest, and Cucumber.
- 100% localhost data sovereignty: zero external cloud calls, no telemetry.
- Seamless traceability linking manual test authoring to automated CI runs via tag matching.
- Failure screenshots captured and stored locally with strict filesystem permissions.
- Zero extra dependencies in `@kobean/cli`.

### Negative / Trade-offs
- File-based report generation requires managing temporary output files and cleanup hooks.
