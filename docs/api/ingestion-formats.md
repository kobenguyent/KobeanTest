# CI/CD Test Ingestion Formats — KobeanTest

KobeanTest accepts automated test results via `POST http://127.0.0.1:4000/api/v1/ci/ingest`.

## 1. Kobean Batch JSON (Recommended)

Optimal for speed and least bandwidth:

```json
{
  "run_name": "Local Playwright Run - Sprint 42",
  "environment": "local-macos",
  "auto_create_cases": true,
  "results": [
    {
      "automation_id": "tests/auth.spec.ts#login_valid_credentials",
      "title": "User can log in with valid credentials",
      "suite_path": ["Authentication", "Login"],
      "status": "passed",
      "duration_ms": 420
    },
    {
      "automation_id": "tests/checkout.spec.ts#stripe_card_declined",
      "title": "Payment declines with expired test card",
      "suite_path": ["E2E", "Checkout", "Payments"],
      "status": "failed",
      "duration_ms": 1250,
      "error_message": "AssertionError: Expected banner 'Card Declined' but got '500 Server Error'",
      "stack_trace": "Error: at checkout.spec.ts:88:14"
    }
  ]
}
```

---

## 2. Standard JUnit XML

Supported by Pytest, Jest, Vitest, JUnit 5, NUnit, and Go test:

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
