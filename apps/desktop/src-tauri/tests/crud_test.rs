use kobean_core::db::{
    create_case, create_project, create_run, create_suite, create_workspace,
    get_case_revisions, get_run, get_run_items, record_execution, run_migrations,
    update_case, update_suite, CreateCaseInput, CreateRunInput, RecordExecutionInput,
    RecordStepResultInput, UpdateCaseInput,
};
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("In-memory test DB open");
    run_migrations(&conn).expect("Migrations run cleanly");
    conn
}

#[test]
fn test_end_to_end_crud_and_execution_lifecycle() {
    let mut conn = setup_test_db();

    // 1. Workspace & Project
    let ws = create_workspace(&conn, "Default Workspace", "default").expect("Create workspace");
    let project = create_project(
        &conn,
        &ws.id,
        "Checkout Engine",
        "CHK",
        Some("E-commerce checkout test cases"),
    )
    .expect("Create project");

    // 2. Suite hierarchy
    let suite_parent = create_suite(
        &conn,
        &project.id,
        None,
        "Payment Flow",
        Some("Payment gateway interactions"),
        Some(1),
    )
    .expect("Create parent suite");

    let suite_child = create_suite(
        &conn,
        &project.id,
        Some(&suite_parent.id),
        "Credit Card Processing",
        None,
        Some(1),
    )
    .expect("Create child suite");

    assert_eq!(suite_child.parent_id, Some(suite_parent.id.clone()));

    // Cycle prevention
    let cycle_err = update_suite(
        &conn,
        &suite_parent.id,
        "Payment Flow",
        None,
        Some(&suite_parent.id),
        None,
    );
    assert!(cycle_err.is_err(), "Suite cannot be parent of itself");

    // 3. Test Cases Creation
    let case1 = create_case(
        &conn,
        CreateCaseInput {
            project_id: project.id.clone(),
            suite_id: Some(suite_child.id.clone()),
            title: "Successful card authorization with 3DS".to_string(),
            preconditions: Some("User has valid Visa card with 3DS enabled".to_string()),
            steps_json: Some(
                r#"[{"number":1,"action":"Enter card number","expected":"Card recognized as Visa"}]"#
                    .to_string(),
            ),
            priority: Some("critical".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("tests/checkout.spec.ts#test-3ds".to_string()),
            tags_json: Some(r#"["payments","3ds","smoke"]"#.to_string()),
        },
    )
    .expect("Create test case 1");

    assert_eq!(case1.case_number, 1);
    assert_eq!(case1.version, 1);

    let case2 = create_case(
        &conn,
        CreateCaseInput {
            project_id: project.id.clone(),
            suite_id: Some(suite_child.id.clone()),
            title: "Declined card with insufficient funds".to_string(),
            preconditions: None,
            steps_json: None,
            priority: Some("high".to_string()),
            type_: Some("manual".to_string()),
            automation_id: None,
            tags_json: None,
        },
    )
    .expect("Create test case 2");

    assert_eq!(case2.case_number, 2);

    // 4. Update Case (creates version 2)
    let updated_case1 = update_case(
        &conn,
        &case1.id,
        UpdateCaseInput {
            suite_id: Some(suite_child.id.clone()),
            title: "Successful card authorization with 3DS v2.2".to_string(),
            preconditions: Some("User has valid 3DS v2.2 test card".to_string()),
            steps_json: Some(
                r#"[{"number":1,"action":"Enter card number","expected":"Card recognized as Visa"},{"number":2,"action":"Complete biometric OTP","expected":"200 OK webhook received"}]"#
                    .to_string(),
            ),
            priority: Some("critical".to_string()),
            type_: Some("automated".to_string()),
            automation_id: Some("tests/checkout.spec.ts#test-3ds".to_string()),
            tags_json: Some(r#"["payments","3ds","smoke","biometrics"]"#.to_string()),
            is_flaky: Some(false),
            is_archived: Some(false),
        },
    )
    .expect("Update case 1");

    assert_eq!(updated_case1.version, 2);

    let revisions = get_case_revisions(&conn, &case1.id).expect("Fetch revisions");
    assert_eq!(revisions.len(), 2);
    assert_eq!(revisions[0].version, 2);
    assert_eq!(revisions[1].version, 1);

    // 5. Create Test Run
    let run = create_run(
        &mut conn,
        CreateRunInput {
            project_id: project.id.clone(),
            title: "Release 2.4 Regression Run".to_string(),
            environment: Some("staging".to_string()),
            source: Some("manual".to_string()),
            idempotency_key: Some("run-idemp-001".to_string()),
            commit_sha: Some("abcdef123456".to_string()),
            branch: Some("release/2.4".to_string()),
            case_ids: vec![case1.id.clone(), case2.id.clone()],
        },
    )
    .expect("Create test run");

    assert_eq!(run.total_count, 2);
    assert_eq!(run.status, "in_progress");

    let items = get_run_items(&conn, &run.id).expect("Get run items");
    assert_eq!(items.len(), 2);

    // Verify item for case1 points to revision version 2
    let item1 = items
        .iter()
        .find(|i| i.item.test_case_id == case1.id)
        .expect("Find item 1");
    assert_eq!(item1.item.case_revision_id, revisions[0].id);
    assert_eq!(item1.item.status, "pending");

    // 6. Record Execution on item 1 (Passed with step results)
    let exec1 = record_execution(
        &mut conn,
        RecordExecutionInput {
            run_item_id: item1.item.id.clone(),
            status: "passed".to_string(),
            duration_ms: Some(1240),
            error_message: None,
            stack_trace: None,
            notes: Some("All 3DS challenges passed on staging sandbox".to_string()),
            executed_by: Some("tester@kobean.local".to_string()),
            step_results: Some(vec![
                RecordStepResultInput {
                    step_number: 1,
                    status: "passed".to_string(),
                    actual_result: Some("Card identified properly".to_string()),
                },
                RecordStepResultInput {
                    step_number: 2,
                    status: "passed".to_string(),
                    actual_result: Some("Biometric challenge verified in 240ms".to_string()),
                },
            ]),
        },
    )
    .expect("Record execution on item 1");

    assert_eq!(exec1.status, "passed");
    assert_eq!(exec1.attempt_number, 1);

    // Check intermediate run progress
    let intermediate_run = get_run(&conn, &run.id).expect("Get updated run");
    assert_eq!(intermediate_run.passed_count, 1);
    assert_eq!(intermediate_run.failed_count, 0);
    assert_eq!(intermediate_run.status, "in_progress");

    // 7. Record Execution on item 2 (Failed)
    let item2 = items
        .iter()
        .find(|i| i.item.test_case_id == case2.id)
        .expect("Find item 2");

    let exec2 = record_execution(
        &mut conn,
        RecordExecutionInput {
            run_item_id: item2.item.id.clone(),
            status: "failed".to_string(),
            duration_ms: Some(450),
            error_message: Some("Expected 402 Payment Required, got 500 Internal Error".to_string()),
            stack_trace: Some("Error at GatewayClient.ts:88".to_string()),
            notes: None,
            executed_by: Some("tester@kobean.local".to_string()),
            step_results: None,
        },
    )
    .expect("Record execution on item 2");

    assert_eq!(exec2.status, "failed");

    // All items resolved! Run should automatically mark as completed
    let finished_run = get_run(&conn, &run.id).expect("Get finished run");
    assert_eq!(finished_run.passed_count, 1);
    assert_eq!(finished_run.failed_count, 1);
    assert_eq!(finished_run.status, "completed");
    assert!(finished_run.completed_at.is_some());

    // 8. Re-execute item 2 (Retry: passed on attempt 2)
    let exec2_retry = record_execution(
        &mut conn,
        RecordExecutionInput {
            run_item_id: item2.item.id.clone(),
            status: "passed".to_string(),
            duration_ms: Some(380),
            error_message: None,
            stack_trace: None,
            notes: Some("Resolved after gateway config hotfix".to_string()),
            executed_by: Some("tester@kobean.local".to_string()),
            step_results: None,
        },
    )
    .expect("Retry item 2");

    assert_eq!(exec2_retry.attempt_number, 2);
    assert_eq!(exec2_retry.status, "passed");

    // Run totals updated
    let retried_run = get_run(&conn, &run.id).expect("Get run after retry");
    assert_eq!(retried_run.passed_count, 2);
    assert_eq!(retried_run.failed_count, 0);

    // 9. Modify test case 1 after the run completed (Version 3)
    let v3_case = update_case(
        &conn,
        &case1.id,
        UpdateCaseInput {
            suite_id: Some(suite_child.id.clone()),
            title: "Successful card authorization with 3DS v3 (Future)".to_string(),
            preconditions: None,
            steps_json: None,
            priority: None,
            type_: None,
            automation_id: None,
            tags_json: None,
            is_flaky: None,
            is_archived: None,
        },
    )
    .expect("Update case to v3");

    assert_eq!(v3_case.version, 3);

    // Check that historical run item STILL references revision version 2!
    let run_items_after_update = get_run_items(&conn, &run.id).expect("Get run items");
    let historical_item1 = run_items_after_update
        .iter()
        .find(|i| i.item.test_case_id == case1.id)
        .expect("Find historical item");
    assert_eq!(historical_item1.item.case_revision_id, revisions[0].id);
    assert_eq!(
        historical_item1.latest_execution.as_ref().map(|e| e.status.as_str()),
        Some("passed")
    );
}
