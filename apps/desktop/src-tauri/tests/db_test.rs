use kobean_core::db::{repopulate_fts_index, run_migrations, search_cases};
use rusqlite::{params, Connection};

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("In-memory test DB open");
    run_migrations(&conn).expect("Migrations run cleanly");
    conn
}

#[test]
fn test_migrations_and_domain_invariants() {
    let conn = setup_test_db();

    // 1. Setup Workspace and Projects
    conn.execute(
        "INSERT INTO workspaces (id, name, slug) VALUES ('ws-1', 'Main Workspace', 'main');",
        [],
    )
    .expect("Insert workspace");

    conn.execute(
        "INSERT INTO projects (id, workspace_id, name, key) VALUES ('proj-1', 'ws-1', 'Project 1', 'P1');",
        [],
    )
    .expect("Insert project 1");

    conn.execute(
        "INSERT INTO projects (id, workspace_id, name, key) VALUES ('proj-2', 'ws-1', 'Project 2', 'P2');",
        [],
    )
    .expect("Insert project 2");

    // 2. Insert Suite in Project 1
    conn.execute(
        "INSERT INTO test_suites (id, project_id, title) VALUES ('suite-1', 'proj-1', 'Auth Suite');",
        [],
    )
    .expect("Insert suite 1 in project 1");

    // Invariant Check 1: Suite cannot be its own parent (Cycle guard)
    let cyclic_res = conn.execute(
        "INSERT INTO test_suites (id, project_id, parent_id, title) VALUES ('suite-cycle', 'proj-1', 'suite-cycle', 'Cyclic');",
        [],
    );
    assert!(cyclic_res.is_err(), "Suite must not allow parent_id == id");

    // Invariant Check 2: Test Case cannot reference a suite from a different project
    let cross_project_res = conn.execute(
        "INSERT INTO test_cases (id, project_id, suite_id, case_number, title)
         VALUES ('case-cross', 'proj-2', 'suite-1', 1, 'Cross Project Case');",
        [],
    );
    assert!(
        cross_project_res.is_err(),
        "Cross-project suite assignment must fail compound foreign key"
    );

    // Invariant Check 3: Duplicate automation_id within same project must be rejected
    conn.execute(
        "INSERT INTO test_cases (id, project_id, suite_id, case_number, title, automation_id)
         VALUES ('case-1', 'proj-1', 'suite-1', 1, 'Login Case', 'tests/auth.spec.ts#login');",
        [],
    )
    .expect("Insert case 1 with automation_id");

    let dup_auto_res = conn.execute(
        "INSERT INTO test_cases (id, project_id, suite_id, case_number, title, automation_id)
         VALUES ('case-2', 'proj-1', 'suite-1', 2, 'Dup Login Case', 'tests/auth.spec.ts#login');",
        [],
    );
    assert!(
        dup_auto_res.is_err(),
        "Duplicate automation_id within same project must be rejected"
    );
}

#[test]
fn test_immutable_execution_history_preserved_on_case_deletion() {
    let conn = setup_test_db();

    // Setup project and case
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES ('ws-1', 'WS', 'ws');", []).unwrap();
    conn.execute("INSERT INTO projects (id, workspace_id, name, key) VALUES ('proj-1', 'ws-1', 'P1', 'P1');", []).unwrap();
    conn.execute("INSERT INTO test_suites (id, project_id, title) VALUES ('suite-1', 'proj-1', 'Suite 1');", []).unwrap();

    conn.execute(
        "INSERT INTO test_cases (id, project_id, suite_id, case_number, title, steps_json, version)
         VALUES ('case-1', 'proj-1', 'suite-1', 101, 'Original Case Title', '[{\"step_number\":1,\"action\":\"A\",\"expected\":\"E\"}]', 1);",
        [],
    ).unwrap();

    // Query automatically generated revision
    let rev_id: String = conn.query_row(
        "SELECT id FROM test_case_revisions WHERE case_id = 'case-1' AND version = 1;",
        [],
        |row| row.get(0),
    ).unwrap();

    // Create Test Run & Run Item referencing revision
    conn.execute(
        "INSERT INTO test_runs (id, project_id, title, total_count, passed_count)
         VALUES ('run-1', 'proj-1', 'Sprint 42 Run', 1, 1);",
        [],
    ).unwrap();

    conn.execute(
        "INSERT INTO test_run_items (id, test_run_id, test_case_id, case_revision_id, status)
         VALUES ('item-1', 'run-1', 'case-1', ?1, 'passed');",
        params![rev_id],
    ).unwrap();

    conn.execute(
        "INSERT INTO test_executions (id, run_item_id, case_revision_id, status, duration_ms)
         VALUES ('exec-1', 'item-1', ?1, 'passed', 120);",
        params![rev_id],
    ).unwrap();

    // Attempting direct hard-delete on case-1 is RESTRICTED because run_items references it
    let delete_res = conn.execute("DELETE FROM test_cases WHERE id = 'case-1';", []);
    assert!(
        delete_res.is_err(),
        "Hard delete of executed test case must be restricted by ON DELETE RESTRICT"
    );

    // Soft-delete / Archive the test case
    conn.execute("UPDATE test_cases SET is_archived = 1 WHERE id = 'case-1';", []).unwrap();

    // Verify historical test run, run item, and execution are 100% intact
    let exec_count: i64 = conn.query_row(
        "SELECT count(*) FROM test_executions WHERE id = 'exec-1' AND status = 'passed';",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(exec_count, 1, "Historical execution must remain intact");

    let run_passed: i64 = conn.query_row(
        "SELECT passed_count FROM test_runs WHERE id = 'run-1';",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(run_passed, 1, "Historical run counts must remain intact");
}

#[test]
fn test_fts5_search_and_authoritative_repopulation() {
    let conn = setup_test_db();

    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES ('ws-1', 'WS', 'ws');", []).unwrap();
    conn.execute("INSERT INTO projects (id, workspace_id, name, key) VALUES ('proj-1', 'ws-1', 'P1', 'P1');", []).unwrap();

    // Insert 3 test cases
    conn.execute(
        "INSERT INTO test_cases (id, project_id, case_number, title, preconditions, steps_json)
         VALUES ('case-auth', 'proj-1', 1, 'Biometric FaceID Login', 'Enrolled biometric data', '[]');",
        [],
    ).unwrap();

    conn.execute(
        "INSERT INTO test_cases (id, project_id, case_number, title, preconditions, steps_json)
         VALUES ('case-pay', 'proj-1', 2, 'Stripe Checkout 3DS', 'Valid credit card', '[]');",
        [],
    ).unwrap();

    conn.execute(
        "INSERT INTO test_cases (id, project_id, case_number, title, preconditions, steps_json)
         VALUES ('case-pass', 'proj-1', 3, 'Password Reset Token Expiry', 'Registered email', '[]');",
        [],
    ).unwrap();

    // 1. Search for "Biometric"
    let hits = search_cases(&conn, "Biometric", 10).expect("Search hits");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].case_id, "case-auth");

    // 2. Search for "Stripe"
    let hits = search_cases(&conn, "Stripe", 10).expect("Search hits");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].case_id, "case-pay");

    // 3. Directly corrupt/clear FTS5 virtual table
    conn.execute("DELETE FROM fts5_cases WHERE case_id = 'case-auth';", []).unwrap();
    let hits_after_delete = search_cases(&conn, "Biometric", 10).expect("Search hits");
    assert_eq!(hits_after_delete.len(), 0, "Missing row should not be found");

    // 4. Run authoritative repopulation
    let restored = repopulate_fts_index(&conn).expect("Repopulate FTS index");
    assert_eq!(restored, 3, "All 3 cases should be re-indexed");

    // 5. Search again: Biometric must be restored!
    let hits_after_repair = search_cases(&conn, "Biometric", 10).expect("Search hits");
    assert_eq!(hits_after_repair.len(), 1, "Authoritative repopulation must restore index");
    assert_eq!(hits_after_repair[0].case_id, "case-auth");
}
