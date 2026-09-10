# ADR-0005: GitHub Repository Connections & Localhost-First Code Traceability

## Status
Accepted

## Context
QA engineers, test automation engineers, and software architects need continuous visibility between test suites/runs and the source code repositories where the tests reside. Specifically:
1. Test suites correspond to test spec files (e.g. `tests/e2e/auth.spec.ts`) hosted on GitHub repositories.
2. Automated and manual test runs execute against specific Git branches, commit SHAs, and Pull Requests.
3. Proprietary cloud test management tools often require granting cloud access tokens, webhook secrets, or OAuth permissions to third-party servers, creating security, privacy, and compliance risks.

KobeanTest requires a seamless way to link Test Suites and Test Runs to GitHub repositories while strictly preserving the core architectural principles: 100% Localhost Sovereignty, Zero Cloud Database Dependencies, and Zero Telemetry.

## Decision

We implement a localhost-first GitHub Repository Connections architecture:

1. **Local SQLite Connection Management (`repo_connections`)**:
   - Store repository metadata (`id`, `project_id`, `provider='github'`, `name`, `repo_name`, `repo_url`, `default_branch`, `created_at`, `updated_at`) strictly inside the local SQLite database.
   - Zero external cloud API calls or GitHub token storage required. External repository links (`https://github.com/:repo/tree/:branch/:file_path` or `https://github.com/:repo/pull/:pr_number`) are constructed client-side and opened directly in the user's browser.

2. **Hierarchical Suite Source Linking**:
   - `test_suites` rows are extended with `repo_connection_id`, `github_repo`, and `file_path`.
   - When CI runs or tests are ingested via directory hierarchy (e.g. Playwright spec paths), KobeanTest automatically preserves the file path and links the suite to matching project connections.
   - The UI provides a direct "View in GitHub" action opening the exact spec file or directory on GitHub.

3. **Execution Run Git & Pull Request Traceability**:
   - `test_runs` rows are extended with `repo_connection_id`, `github_repo`, `pull_request_number`, and `pull_request_url`.
   - The CLI runner (`kobean run` / `kobean report`) auto-detects standard CI environment variables:
     - `GITHUB_REPOSITORY`
     - `GITHUB_REF_NAME` / `GIT_BRANCH`
     - `GITHUB_SHA` / `GIT_COMMIT`
     - `GITHUB_REF` (extracting PR numbers from `refs/pull/:pr/merge`)
   - The Kobean daemon automatically matches `github_repo` to an existing project `repo_connection_id` when available.
   - The Execution View renders interactive GitHub metadata chips (repository, branch, commit SHA, and Pull Request link).

4. **100% Localhost Privacy & Security**:
   - No GitHub tokens, passwords, or personal access credentials are required or stored.
   - All connection records and linking tables inherit SQLite WAL mode and POSIX `0600` database file permissions.

## Consequences

### Positive
- Direct traceability from KobeanTest suites and execution runs to GitHub repositories, files, and pull requests.
- Complete data privacy: 0 bytes of proprietary test code, suite structure, or test results are transmitted to third-party servers.
- Automatic CI correlation: GitHub Actions, local git checkouts, and external CI jobs automatically correlate commit and PR metadata without manual tagging.
- Fast, non-blocking UI navigation with Linear-grade aesthetic badges and chips.

### Negative / Trade-offs
- Deep GitHub API automation (e.g. posting PR comments or status checks directly from the desktop shell) is intentionally avoided to keep the application 100% air-gapped and localhost-only without credentials management complexity.
