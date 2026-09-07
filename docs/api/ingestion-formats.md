# CI/CD Test Ingestion Formats — KobeanTest

KobeanTest accepts automated test results via:
`POST http://127.0.0.1:4000/api/v1/projects/:project_id/ci/ingest`

All requests must supply:
`Authorization: Bearer <session_token>` (retrieved from `~/.kobean/session.json`).

## 1. Kobean Batch JSON (Recommended)

Requires an `idempotency_key` (or CI build key) to prevent duplicate runs on network retries:

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
      "title": "User can log in with valid credentials",
      "suite_path": ["Authentication", "Login"],
      "status": "passed",
      "duration_ms": 420,
      "attempt_number": 1
    },
    {
      "automation_id": "tests/checkout.spec.ts#stripe_card_declined",
      "title": "Payment declines with expired test card",
      "suite_path": ["E2E", "Checkout", "Payments"],
      "status": "failed",
      "duration_ms": 1250,
      "attempt_number": 1,
      "error_message": "AssertionError: Expected banner 'Card Declined' but got '500 Server Error'",
      "stack_trace": "Error: at checkout.spec.ts:88:14"
    }
  ]
}
```

---

## 2. Standard JUnit XML with Idempotency Header

When uploading raw JUnit XML files, supply the idempotency key and run title in query parameters or HTTP headers:

```http
POST /api/v1/projects/KB-PROJ-01/ci/ingest?idempotency_key=ci-build-8812&run_name=Pytest+Regression
Authorization: Bearer <token>
Content-Type: application/xml
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Regression" tests="2" failures="1" time="1.67">
  <testsuite name="Authentication" tests="1" time="0.42">
    <testcase classname="tests.auth" name="test_login_valid" time="0.42" />
  </testsuite>
  <testsuite name="Payments" tests="1" failures="1" time="1.25">
    <testcase classname="tests.checkout" name="test_stripe_card_declined" time="1.25">
      <failure message="Card Declined banner missing">
        AssertionError: Expected banner 'Card Declined'
        at checkout.spec.ts:88:14
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```
