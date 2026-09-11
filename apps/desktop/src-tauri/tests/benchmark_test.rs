use kobean_core::db::cases::{create_case, CreateCaseInput};
use kobean_core::db::fts::search_cases;
use kobean_core::db::ingest::{ingest_batch, IngestBatchInput, IngestCaseResult};
use kobean_core::db::{create_project, create_workspace, run_migrations};
use rusqlite::Connection;
use std::time::Instant;

#[test]
fn test_batch_ci_ingestion_throughput_benchmark_sla() {
    let mut conn = Connection::open_in_memory().expect("In-memory DB");
    run_migrations(&mut conn).expect("Migrations run");

    let ws = create_workspace(&conn, "Bench Workspace", "bench-ws").expect("Workspace");
    let project = create_project(&conn, &ws.id, "High Scale CI Suite", "CI", None).expect("Project");

    // Generate 10,000 synthetic test results
    let mut results = Vec::with_capacity(10_000);
    for i in 1..=10_000 {
        let status = if i % 50 == 0 {
            "failed"
        } else if i % 100 == 0 {
            "skipped"
        } else {
            "passed"
        };

        results.push(IngestCaseResult {
            automation_id: format!("tests/e2e/spec_{}.ts#test_case_{}", i % 200, i),
            title: format!("Verify automated user scenario #{} with security checks", i),
            suite_path: None,
            tags: None,
            status: status.to_string(),
            duration_ms: Some((i % 500) as i64 + 10),
            error_message: if status == "failed" {
                Some("Assertion timeout at selector .btn-submit".to_string())
            } else {
                None
            },
            stack_trace: None,
            attempt_number: Some(1),
            attachments: None,
        });
    }

    let input = IngestBatchInput {
        project_id: project.id.clone(),
        run_name: "Nightly 10k Monolithic CI Batch".to_string(),
        idempotency_key: "ci-bench-batch-10k".to_string(),
        commit_sha: Some("abcdef1234567890".to_string()),
        branch: Some("main".to_string()),
        environment: None,
        auto_create_cases: Some(true),
        results,
        ..Default::default()
    };

    // Benchmark ingestion
    let start = Instant::now();
    let resp = ingest_batch(&mut conn, input).expect("Ingest batch");
    let elapsed = start.elapsed();

    assert_eq!(resp.ingested_count, 10_000);
    assert!(!resp.is_duplicate);

    println!(
        "\n⚡ [BENCHMARK] 10,000 CI test cases ingested into SQLite in {:?} ({:.2} cases/sec)",
        elapsed,
        10_000.0 / elapsed.as_secs_f64()
    );

    // SLA Threshold Calibration:
    // - Production / Release mode (bare metal): Strict SLA < 2,000ms (10k cases)
    // - Production / Release mode (shared CI runner VM): < 3,000ms
    // - Unoptimized Debug mode (local developer): < 3,500ms
    // - Unoptimized Debug mode (shared CI runner VM with CPU throttling): < 6,000ms
    let is_debug = cfg!(debug_assertions);
    let is_ci = std::env::var("CI").is_ok();

    let sla_ms: u128 = match (is_debug, is_ci) {
        (false, false) => 2000,
        (false, true) => 3000,
        (true, false) => 3500,
        (true, true) => 6000,
    };

    assert!(
        elapsed.as_millis() < sla_ms,
        "Ingestion time {:?} exceeded SLA of {}ms (debug={}, ci={})",
        elapsed,
        sla_ms,
        is_debug,
        is_ci
    );
}

#[test]
fn test_fts5_search_latency_sla_under_5ms() {
    let mut conn = Connection::open_in_memory().expect("In-memory DB");
    run_migrations(&mut conn).expect("Migrations run");

    let ws = create_workspace(&conn, "Search Bench Workspace", "search-ws").expect("Workspace");
    let project = create_project(&conn, &ws.id, "Search Scale Suite", "SRC", None).expect("Project");

    // Populate 1,000 varied test cases for search
    for i in 1..=1_000 {
        create_case(
            &conn,
            CreateCaseInput {
                project_id: project.id.clone(),
                suite_id: None,
                title: format!(
                    "Checkout payment verification scenario #{} for biometric oauth authentication",
                    i
                ),
                preconditions: Some("Staging test customer with active payment card".to_string()),
                steps_json: Some(
                    r#"[{"step_number":1,"action":"Submit credentials","expected":"Success"}]"#
                        .to_string(),
                ),
                priority: Some("high".to_string()),
                type_: Some("automated".to_string()),
                automation_id: Some(format!("tests/search_{}.spec.ts", i)),
                tags_json: Some(r#"["auth","billing","security"]"#.to_string()),
            },
        )
        .expect("Create case");
    }

    // Benchmark search queries
    let queries = ["biometric", "payment", "authentication", "checkout"];
    // SLA Threshold Calibration:
    // - Production / Release mode (bare metal): Strict SLA < 5ms per query
    // - Production / Release mode (shared CI runner VM): < 8ms
    // - Unoptimized Debug mode (local developer): < 10ms
    // - Unoptimized Debug mode (shared CI runner VM with CPU throttling): < 20ms
    let is_debug = cfg!(debug_assertions);
    let is_ci = std::env::var("CI").is_ok();

    let search_sla_ms: u128 = match (is_debug, is_ci) {
        (false, false) => 5,
        (false, true) => 8,
        (true, false) => 10,
        (true, true) => 20,
    };

    for q in queries {
        let start = Instant::now();
        let hits = search_cases(&conn, q, 50).expect("Search cases");
        let elapsed = start.elapsed();

        assert!(!hits.is_empty());
        println!(
            "⚡ [BENCHMARK] FTS5 search query {:?} returned {} hits in {:?}",
            q,
            hits.len(),
            elapsed
        );

        assert!(
            elapsed.as_millis() < search_sla_ms,
            "Search query {:?} took {:?}, exceeding {}ms SLA (debug={}, ci={})",
            q,
            elapsed,
            search_sla_ms,
            is_debug,
            is_ci
        );
    }
}
