# ADR-0002: Embedded SQLite with FTS5 for 100% Localhost Storage

## Status
Accepted

## Context
KobeanTest requires a data storage engine that:
- Runs 100% locally with zero cloud dependencies.
- Requires zero external database server installation or setup (no Docker or Postgres service required).
- Supports instant, sub-5ms full-text search across 50,000+ test cases and steps.
- Supports concurrent read and write operations during automated test ingestion.

## Decision
We adopt **SQLite 3** compiled directly into the application with:
- **Write-Ahead Logging (WAL)**: `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;` for concurrent read/write throughput.
- **FTS5 Virtual Table**: `fts5_cases` with Porter stemmer and BM25 ranking for sub-millisecond search across titles, preconditions, steps, and tags.

## Consequences
### Positive
- Zero external software dependencies: single `.db` file in the user's OS application data directory.
- Instant backups: users can copy or sync `kobean.db` as a single atomic file.
- Sub-5ms search queries executed directly against local NVMe storage.

### Negative / Trade-offs
- Multi-user write concurrency across a network requires the local HTTP/WebSocket daemon to serialize writes.
