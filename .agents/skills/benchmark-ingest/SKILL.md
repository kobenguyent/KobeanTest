---
name: benchmark-ingest
description: Benchmark local CI batch test result ingestion throughput against SQLite
---

# Benchmark Ingestion Workflow

When running CI ingestion benchmarks:
1. Generate a mock batch of 1,000 to 10,000 test execution results in JSON or JUnit XML format.
2. Send the payload to the local ingestion endpoint (`POST http://127.0.0.1:4000/api/v1/ci/ingest`).
3. Measure:
   - Wall-clock time to parse and persist.
   - Target SLA: `< 500ms` for 1,000 results, `< 2,000ms` for 10,000 results.
   - Verify SQLite WAL journal growth and commit integrity.
