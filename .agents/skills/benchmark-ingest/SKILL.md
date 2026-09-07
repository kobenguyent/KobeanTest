---
name: benchmark-ingest
description: Benchmark local CI batch test result ingestion throughput against SQLite
---

# Benchmark Ingestion Workflow

## Prerequisites (Must Verify Before Running)
1. **Running Daemon**: Verify that the local daemon is active on `http://127.0.0.1:4000/api/v1/health`.
2. **Authentication Token**: Read the session token from `~/.kobean/session.json` to supply `Authorization: Bearer <token>`.
3. **Disposable Target Project**: Always execute benchmarks against an isolated, disposable project (e.g. `project_id: "benchmarks-temp"`), NEVER production or user test repositories. Clean up the disposable project post-benchmark.

## Execution Steps
1. Generate synthetic batch payloads:
   - 1,000 cases (Small regression batch)
   - 10,000 cases (Large monolithic CI suite)
2. Submit batch payload to `POST http://127.0.0.1:4000/api/v1/projects/benchmarks-temp/ci/ingest` with an `idempotency_key`.
3. Measure:
   - Wall-clock response time (SLA: `< 2,000ms` for 10k cases).
   - Checkpoint integrity and WAL file size.
