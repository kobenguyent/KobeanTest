use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestCaseResult {
    pub automation_id: String,
    pub title: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
    pub attempt_number: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestBatchInput {
    #[serde(default)]
    pub project_id: String,
    pub idempotency_key: String,
    pub run_name: String,
    pub commit_sha: Option<String>,
    pub branch: Option<String>,
    pub auto_create_cases: Option<bool>,
    pub results: Vec<IngestCaseResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IngestBatchResponse {
    pub run_id: String,
    pub ingested_count: usize,
    pub created_cases_count: usize,
    pub is_duplicate: bool,
}

pub fn ingest_batch(
    conn: &mut Connection,
    input: IngestBatchInput,
) -> Result<IngestBatchResponse, AppError> {
    if input.idempotency_key.trim().is_empty() {
        return Err(AppError::Validation("idempotency_key cannot be empty".to_string()));
    }
    if input.run_name.trim().is_empty() {
        return Err(AppError::Validation("run_name cannot be empty".to_string()));
    }

    // 1. Idempotency Check
    let existing_run_id: Option<String> = conn
        .query_row(
            "SELECT id FROM test_runs WHERE idempotency_key = ?1",
            params![input.idempotency_key],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(run_id) = existing_run_id {
        return Ok(IngestBatchResponse {
            run_id,
            ingested_count: 0,
            created_cases_count: 0,
            is_duplicate: true,
        });
    }

    let run_id = Uuid::new_v4().to_string();
    let auto_create = input.auto_create_cases.unwrap_or(true);
    let total_results = input.results.len();
    let mut created_cases_count = 0;

    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO test_runs (
            id, project_id, title, environment, source, status,
            idempotency_key, commit_sha, branch, total_count
        ) VALUES (?1, ?2, ?3, 'ci', 'ci', 'in_progress', ?4, ?5, ?6, ?7)",
        params![
            run_id,
            input.project_id,
            input.run_name,
            input.idempotency_key,
            input.commit_sha,
            input.branch,
            total_results as i64,
        ],
    )?;

    for result in &input.results {
        // Validate status
        let status = match result.status.as_str() {
            "passed" | "failed" | "blocked" | "skipped" => result.status.as_str(),
            _ => "failed",
        };

        // Find or create test case
        let existing_case_id: Option<String> = tx
            .query_row(
                "SELECT id FROM test_cases WHERE project_id = ?1 AND automation_id = ?2",
                params![input.project_id, result.automation_id],
                |row| row.get(0),
            )
            .optional()?;

        let case_id = match existing_case_id {
            Some(id) => id,
            None => {
                if !auto_create {
                    continue;
                }
                let new_case_id = Uuid::new_v4().to_string();
                let next_num: i64 = tx.query_row(
                    "SELECT COALESCE(MAX(case_number), 0) + 1 FROM test_cases WHERE project_id = ?1",
                    params![input.project_id],
                    |row| row.get(0),
                )?;

                tx.execute(
                    "INSERT INTO test_cases (
                        id, project_id, case_number, title, priority, type,
                        automation_id, steps_json, tags_json, is_flaky, is_archived, version
                    ) VALUES (?1, ?2, ?3, ?4, 'medium', 'automated', ?5, '[]', '[]', 0, 0, 1)",
                    params![new_case_id, input.project_id, next_num, result.title, result.automation_id],
                )?;
                created_cases_count += 1;
                new_case_id
            }
        };

        // Fetch latest revision
        let revision_id: String = tx.query_row(
            "SELECT id FROM test_case_revisions WHERE case_id = ?1 ORDER BY version DESC LIMIT 1",
            params![case_id],
            |row| row.get(0),
        )?;

        // Create run item
        let item_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO test_run_items (id, test_run_id, test_case_id, case_revision_id, status)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![item_id, run_id, case_id, revision_id, status],
        )?;

        // Create execution
        let exec_id = Uuid::new_v4().to_string();
        let attempt = result.attempt_number.unwrap_or(1);
        let duration = result.duration_ms.unwrap_or(0);

        tx.execute(
            "INSERT INTO test_executions (
                id, run_item_id, case_revision_id, attempt_number, status,
                duration_ms, error_message, stack_trace
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                exec_id,
                item_id,
                revision_id,
                attempt,
                status,
                duration,
                result.error_message,
                result.stack_trace,
            ],
        )?;
    }

    // Recalculate aggregates
    let (passed, failed, skipped, blocked): (i64, i64, i64, i64) = tx.query_row(
        "SELECT 
            COALESCE(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0)
         FROM test_run_items WHERE test_run_id = ?1",
        params![run_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )?;

    tx.execute(
        "UPDATE test_runs SET
            passed_count = ?1,
            failed_count = ?2,
            skipped_count = ?3,
            blocked_count = ?4,
            status = 'completed',
            completed_at = (strftime('%s', 'now'))
         WHERE id = ?5",
        params![passed, failed, skipped, blocked, run_id],
    )?;

    tx.commit()?;

    Ok(IngestBatchResponse {
        run_id,
        ingested_count: total_results,
        created_cases_count,
        is_duplicate: false,
    })
}
