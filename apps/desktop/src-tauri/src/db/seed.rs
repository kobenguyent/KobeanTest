use crate::db::{
    create_case, create_run, create_suite_full, get_run_items,
    record_execution, CreateCaseInput, CreateRunInput, CreateSuiteInput, RecordExecutionInput,
};
use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn seed_starter_data(conn: &mut Connection) -> Result<(), AppError> {
    // 1. Ensure Default Workspace exists
    let existing_ws: Option<String> = conn
        .query_row(
            "SELECT id FROM workspaces WHERE slug = 'default' LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()?;

    let ws_id = match existing_ws {
        Some(id) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (?1, ?2, ?3)",
                params![id, "Default Workspace", "default"],
            )?;
            id
        }
    };

    // 2. Ensure Default Project exists
    let existing_project: Option<String> = conn
        .query_row(
            "SELECT id FROM projects WHERE workspace_id = ?1 ORDER BY created_at ASC LIMIT 1",
            params![ws_id],
            |r| r.get(0),
        )
        .optional()?;

    let project_id = match existing_project {
        Some(id) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO projects (id, workspace_id, name, key, description) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    id,
                    ws_id,
                    "Core Platform",
                    "CORE",
                    "High-reliability desktop and localhost test management engine"
                ],
            )?;
            id
        }
    };

    // 2b. Check if already seeded
    let existing_case_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM test_cases WHERE project_id = ?1",
            params![project_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if existing_case_count > 0 {
        let run_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM test_runs WHERE project_id = ?1",
                params![project_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if run_count == 0 {
            seed_run_for_project(conn, &project_id)?;
        }
        return Ok(());
    }

    // 3. Create Test Suites (cleanly without forced GitHub repository connection)
    let suite_auth = create_suite_full(
        conn,
        CreateSuiteInput {
            project_id: project_id.clone(),
            title: "Authentication & Identity".to_string(),
            description: Some("Biometrics, OAuth2, and Session lifecycle".to_string()),
            position: Some(1),
            ..Default::default()
        },
    )?;

    let suite_checkout = create_suite_full(
        conn,
        CreateSuiteInput {
            project_id: project_id.clone(),
            title: "Shopping Cart & Checkout".to_string(),
            description: Some("Cart state mutations, payment processing, promo codes".to_string()),
            position: Some(2),
            ..Default::default()
        },
    )?;

    let suite_edge = create_suite_full(
        conn,
        CreateSuiteInput {
            project_id: project_id.clone(),
            title: "API Gateway & Edge".to_string(),
            description: Some("Rate limiting, loopback auth, and telemetry".to_string()),
            position: Some(3),
            ..Default::default()
        },
    )?;

    // 4. Create Test Cases
    let case1 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_auth.id.clone()),
            title: "Verify biometric 2FA step-up authentication on high-risk withdrawal".to_string(),
            preconditions: Some("User logged in with trusted device and high-value balance ($10,000+)".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Trigger withdrawal over $5,000 threshold", "expected": "System responds with 403 Challenge: Biometric Step-up Required"}, {"step_number": 2, "action": "Present valid WebAuthn/TouchID hardware credential", "expected": "200 OK signed signature token returned"}, {"step_number": 3, "action": "Confirm transaction execution", "expected": "Balance deducted and audit ledger entry written"}]"#.to_string()
            ),
            priority: Some("critical".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("auth.biometric.otp.stepup".to_string()),
            tags_json: Some(r#"["security", "p0", "biometrics", "compliance"]"#.to_string()),
        },
    )?;

    let case2 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_auth.id.clone()),
            title: "Session token rotation on concurrent device login".to_string(),
            preconditions: Some("Active session exists on Device A".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Authenticate new login from Device B", "expected": "New session token issued with distinct device fingerprint"}, {"step_number": 2, "action": "Verify Device A receives silent invalidation ping", "expected": "Device A session revoked within 500ms"}]"#.to_string()
            ),
            priority: Some("high".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("auth.session.rotation".to_string()),
            tags_json: Some(r#"["auth", "session", "security"]"#.to_string()),
        },
    )?;

    let case3 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_checkout.id.clone()),
            title: "Verify atomic cart checkout with Stripe 3D-Secure idempotency".to_string(),
            preconditions: Some("Cart contains 3 items totaling $249.99 with valid shipping address".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Submit checkout with Idempotency-Key header", "expected": "Payment intent created in RequiresAction state"}, {"step_number": 2, "action": "Simulate duplicate network request with same Idempotency-Key", "expected": "Original payment intent returned without double charge"}, {"step_number": 3, "action": "Complete 3DS challenge", "expected": "Order status moves to Confirmed; receipt email queued"}]"#.to_string()
            ),
            priority: Some("critical".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("checkout.stripe.3ds.idempotent".to_string()),
            tags_json: Some(r#"["payments", "checkout", "p0", "stripe"]"#.to_string()),
        },
    )?;

    let case4 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_checkout.id.clone()),
            title: "Apply stackable discount coupon during flash sale countdown".to_string(),
            preconditions: Some("Active cart with minimum subtotal of $50".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Enter coupon code 'SUMMER50' into promo box", "expected": "Validating spinner appears for < 100ms; subtotal recalculated"}, {"step_number": 2, "action": "Inspect tax recalculation", "expected": "Sales tax updated accurately to post-discount total"}]"#.to_string()
            ),
            priority: Some("medium".to_string()),
            type_: Some("manual".to_string()),
            automation_id: None,
            tags_json: Some(r#"["checkout", "promotions", "ui"]"#.to_string()),
        },
    )?;

    let case5 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_edge.id.clone()),
            title: "Rate limiter enforces 100 req/min threshold on public edge endpoint".to_string(),
            preconditions: Some("Unauthenticated client IP".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Send 100 consecutive GET requests within 10 seconds", "expected": "All 100 requests return 200 OK with X-RateLimit-Remaining decrementing"}, {"step_number": 2, "action": "Send 101st request", "expected": "HTTP 429 Too Many Requests with Retry-After header"}]"#.to_string()
            ),
            priority: Some("high".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("edge.ratelimit.throttle".to_string()),
            tags_json: Some(r#"["api", "performance", "infra"]"#.to_string()),
        },
    )?;

    let case6 = create_case(
        conn,
        CreateCaseInput {
            project_id: project_id.clone(),
            suite_id: Some(suite_edge.id.clone()),
            title: "FTS5 Porter stemmer query matches inflected search terms".to_string(),
            preconditions: Some("SQLite FTS5 virtual table populated with test cases".to_string()),
            steps_json: Some(
                r#"[{"step_number": 1, "action": "Query FTS5 table for 'paying'", "expected": "Matches 'payment', 'pays', and 'payments' in < 2ms"}]"#.to_string()
            ),
            priority: Some("medium".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("search.fts5.porter.stemmer".to_string()),
            tags_json: Some(r#"["search", "sqlite", "perf"]"#.to_string()),
        },
    )?;

    // 5. Create Test Run
    let all_case_ids = vec![
        case1.id.clone(),
        case2.id.clone(),
        case3.id.clone(),
        case4.id.clone(),
        case5.id.clone(),
        case6.id.clone(),
    ];

    let run_input = CreateRunInput {
        project_id: project_id.clone(),
        title: "Sprint 42 Release Regression".to_string(),
        environment: Some("Staging Localhost".to_string()),
        source: Some("manual".to_string()),
        idempotency_key: Some(format!("seed-run-{}", Uuid::new_v4())),
        commit_sha: None,
        branch: None,
        repo_connection_id: None,
        github_repo: None,
        pull_request_number: None,
        pull_request_url: None,
        case_ids: all_case_ids,
    };

    let run = create_run(conn, run_input)?;
    let run_items = get_run_items(conn, &run.id)?;

    // 6. Record Initial Triage Executions
    for detail in run_items {
        if detail.item.test_case_id == case1.id {
            record_execution(
                conn,
                RecordExecutionInput {
                    run_item_id: detail.item.id.clone(),
                    status: "passed".to_string(),
                    duration_ms: Some(142),
                    error_message: None,
                    stack_trace: None,
                    notes: Some("Biometric challenge completed successfully on mock YubiKey".to_string()),
                    executed_by: Some("QA Engineer".to_string()),
                    step_results: None,
                },
            )?;
        } else if detail.item.test_case_id == case2.id {
            record_execution(
                conn,
                RecordExecutionInput {
                    run_item_id: detail.item.id.clone(),
                    status: "passed".to_string(),
                    duration_ms: Some(88),
                    error_message: None,
                    stack_trace: None,
                    notes: Some("Device A session successfully invalidated via WebSocket ping".to_string()),
                    executed_by: Some("QA Engineer".to_string()),
                    step_results: None,
                },
            )?;
        } else if detail.item.test_case_id == case3.id {
            record_execution(
                conn,
                RecordExecutionInput {
                    run_item_id: detail.item.id.clone(),
                    status: "failed".to_string(),
                    duration_ms: Some(310),
                    error_message: Some("Duplicate key exception in mock sandbox ledger".to_string()),
                    stack_trace: Some("Error: UniqueConstraintViolation at /packages/payments/src/idempotency.ts:42".to_string()),
                    notes: Some("Idempotency collision on duplicate payload in mock sandbox".to_string()),
                    executed_by: Some("QA Engineer".to_string()),
                    step_results: None,
                },
            )?;
        } else if detail.item.test_case_id == case5.id {
            record_execution(
                conn,
                RecordExecutionInput {
                    run_item_id: detail.item.id.clone(),
                    status: "blocked".to_string(),
                    duration_ms: Some(22),
                    error_message: Some("Upstream edge reverse proxy unreachable".to_string()),
                    stack_trace: None,
                    notes: Some("Edge proxy rate limit bypass rule missing in staging config".to_string()),
                    executed_by: Some("QA Engineer".to_string()),
                    step_results: None,
                },
            )?;
        }
    }

    Ok(())
}

fn seed_run_for_project(conn: &mut Connection, project_id: &str) -> Result<(), AppError> {
    let case_ids: Vec<String> = {
        let mut stmt = conn.prepare("SELECT id FROM test_cases WHERE project_id = ?1 ORDER BY case_number ASC LIMIT 20")?;
        let rows = stmt.query_map(params![project_id], |row| row.get(0))?;
        let mut ids = Vec::new();
        for id in rows.flatten() {
            ids.push(id);
        }
        ids
    };

    if case_ids.is_empty() {
        return Ok(());
    }

    let run_input = CreateRunInput {
        project_id: project_id.to_string(),
        title: "Sprint 42 Release Regression".to_string(),
        environment: Some("Staging Localhost".to_string()),
        source: Some("manual".to_string()),
        idempotency_key: Some(format!("seed-run-{}", Uuid::new_v4())),
        commit_sha: Some("9faa2f7".to_string()),
        branch: Some("main".to_string()),
        case_ids: case_ids.clone(),
        ..Default::default()
    };

    let run = create_run(conn, run_input)?;
    let run_items = get_run_items(conn, &run.id)?;

    if let Some(first_item) = run_items.first() {
        let _ = record_execution(
            conn,
            RecordExecutionInput {
                run_item_id: first_item.item.id.clone(),
                status: "passed".to_string(),
                duration_ms: Some(120),
                error_message: None,
                stack_trace: None,
                notes: Some("Passed initial health verification".to_string()),
                executed_by: Some("System".to_string()),
                step_results: None,
            },
        );
    }

    Ok(())
}
