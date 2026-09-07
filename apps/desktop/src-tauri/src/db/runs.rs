use crate::error::AppError;
use crate::models::{ExecutionAttachment, TestExecution, TestRun, TestRunItem};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRunInput {
    #[serde(default)]
    pub project_id: String,
    pub title: String,
    pub environment: Option<String>,
    pub source: Option<String>,
    pub idempotency_key: Option<String>,
    pub commit_sha: Option<String>,
    pub branch: Option<String>,
    pub case_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordStepResultInput {
    pub step_number: i64,
    pub status: String,
    pub actual_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordExecutionInput {
    pub run_item_id: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
    pub notes: Option<String>,
    pub executed_by: Option<String>,
    pub step_results: Option<Vec<RecordStepResultInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunItemDetail {
    pub item: TestRunItem,
    pub case_title: String,
    pub case_number: i64,
    pub priority: String,
    pub latest_execution: Option<TestExecution>,
}

pub fn create_run(conn: &mut Connection, input: CreateRunInput) -> Result<TestRun, AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Test run title cannot be empty".to_string()));
    }

    // Idempotency check
    if let Some(ref ikey) = input.idempotency_key {
        let existing: Option<TestRun> = conn
            .query_row(
                "SELECT id, project_id, title, environment, source, status, idempotency_key,
                        commit_sha, branch, total_count, passed_count, failed_count,
                        skipped_count, blocked_count, created_at, completed_at
                 FROM test_runs WHERE idempotency_key = ?1",
                params![ikey],
                |row| {
                    Ok(TestRun {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        title: row.get(2)?,
                        environment: row.get(3)?,
                        source: row.get(4)?,
                        status: row.get(5)?,
                        idempotency_key: row.get(6)?,
                        commit_sha: row.get(7)?,
                        branch: row.get(8)?,
                        total_count: row.get(9)?,
                        passed_count: row.get(10)?,
                        failed_count: row.get(11)?,
                        skipped_count: row.get(12)?,
                        blocked_count: row.get(13)?,
                        created_at: row.get(14)?,
                        completed_at: row.get(15)?,
                    })
                },
            )
            .optional()?;

        if let Some(run) = existing {
            return Ok(run);
        }
    }

    let run_id = Uuid::new_v4().to_string();
    let environment = input.environment.unwrap_or_else(|| "local".to_string());
    let source = input.source.unwrap_or_else(|| "manual".to_string());
    let total_count = input.case_ids.len() as i64;

    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO test_runs (
            id, project_id, title, environment, source, status,
            idempotency_key, commit_sha, branch, total_count
        ) VALUES (?1, ?2, ?3, ?4, ?5, 'in_progress', ?6, ?7, ?8, ?9)",
        params![
            run_id,
            input.project_id,
            input.title,
            environment,
            source,
            input.idempotency_key,
            input.commit_sha,
            input.branch,
            total_count,
        ],
    )?;

    // Link each test case to its latest revision
    for case_id in &input.case_ids {
        let rev_id: String = tx
            .query_row(
                "SELECT id FROM test_case_revisions WHERE case_id = ?1 ORDER BY version DESC LIMIT 1",
                params![case_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound(format!("No revision found for case: {case_id}")))?;

        let item_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO test_run_items (id, test_run_id, test_case_id, case_revision_id, status)
             VALUES (?1, ?2, ?3, ?4, 'pending')",
            params![item_id, run_id, case_id, rev_id],
        )?;
    }

    tx.commit()?;

    get_run(conn, &run_id)
}

pub fn get_run(conn: &Connection, id: &str) -> Result<TestRun, AppError> {
    conn.query_row(
        "SELECT id, project_id, title, environment, source, status, idempotency_key,
                commit_sha, branch, total_count, passed_count, failed_count,
                skipped_count, blocked_count, created_at, completed_at
         FROM test_runs WHERE id = ?1",
        params![id],
        |row| {
            Ok(TestRun {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                environment: row.get(3)?,
                source: row.get(4)?,
                status: row.get(5)?,
                idempotency_key: row.get(6)?,
                commit_sha: row.get(7)?,
                branch: row.get(8)?,
                total_count: row.get(9)?,
                passed_count: row.get(10)?,
                failed_count: row.get(11)?,
                skipped_count: row.get(12)?,
                blocked_count: row.get(13)?,
                created_at: row.get(14)?,
                completed_at: row.get(15)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("TestRun not found: {id}")))
}

pub fn list_runs(conn: &Connection, project_id: &str) -> Result<Vec<TestRun>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, environment, source, status, idempotency_key,
                commit_sha, branch, total_count, passed_count, failed_count,
                skipped_count, blocked_count, created_at, completed_at
         FROM test_runs
         WHERE project_id = ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(TestRun {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            environment: row.get(3)?,
            source: row.get(4)?,
            status: row.get(5)?,
            idempotency_key: row.get(6)?,
            commit_sha: row.get(7)?,
            branch: row.get(8)?,
            total_count: row.get(9)?,
            passed_count: row.get(10)?,
            failed_count: row.get(11)?,
            skipped_count: row.get(12)?,
            blocked_count: row.get(13)?,
            created_at: row.get(14)?,
            completed_at: row.get(15)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn get_run_items(conn: &Connection, run_id: &str) -> Result<Vec<RunItemDetail>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT tri.id, tri.test_run_id, tri.test_case_id, tri.case_revision_id, tri.status, tri.assigned_to,
                tc.title, tc.case_number, tc.priority
         FROM test_run_items tri
         JOIN test_cases tc ON tc.id = tri.test_case_id
         WHERE tri.test_run_id = ?1
         ORDER BY tc.case_number ASC",
    )?;

    let rows = stmt.query_map(params![run_id], |row| {
        Ok((
            TestRunItem {
                id: row.get(0)?,
                test_run_id: row.get(1)?,
                test_case_id: row.get(2)?,
                case_revision_id: row.get(3)?,
                status: row.get(4)?,
                assigned_to: row.get(5)?,
            },
            row.get::<_, String>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, String>(8)?,
        ))
    })?;

    let mut details = Vec::new();
    for row in rows {
        let (item, case_title, case_number, priority) = row?;

        // Latest execution for this run item
        let latest_execution: Option<TestExecution> = conn
            .query_row(
                "SELECT id, run_item_id, case_revision_id, attempt_number, status, duration_ms,
                        error_message, stack_trace, notes, executed_by, executed_at
                 FROM test_executions
                 WHERE run_item_id = ?1
                 ORDER BY attempt_number DESC LIMIT 1",
                params![item.id],
                |erow| {
                    Ok(TestExecution {
                        id: erow.get(0)?,
                        run_item_id: erow.get(1)?,
                        case_revision_id: erow.get(2)?,
                        attempt_number: erow.get(3)?,
                        status: erow.get(4)?,
                        duration_ms: erow.get(5)?,
                        error_message: erow.get(6)?,
                        stack_trace: erow.get(7)?,
                        notes: erow.get(8)?,
                        executed_by: erow.get(9)?,
                        executed_at: erow.get(10)?,
                    })
                },
            )
            .optional()?;

        details.push(RunItemDetail {
            item,
            case_title,
            case_number,
            priority,
            latest_execution,
        });
    }

    Ok(details)
}

pub fn record_execution(conn: &mut Connection, input: RecordExecutionInput) -> Result<TestExecution, AppError> {
    match input.status.as_str() {
        "passed" | "failed" | "blocked" | "skipped" => (),
        _ => return Err(AppError::Validation(format!("Invalid execution status: {}", input.status))),
    }

    let (run_id, case_rev_id): (String, String) = conn
        .query_row(
            "SELECT test_run_id, case_revision_id FROM test_run_items WHERE id = ?1",
            params![input.run_item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("TestRunItem not found: {}", input.run_item_id)))?;

    let attempt_number: i64 = conn.query_row(
        "SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM test_executions WHERE run_item_id = ?1",
        params![input.run_item_id],
        |row| row.get(0),
    )?;

    let exec_id = Uuid::new_v4().to_string();
    let duration_ms = input.duration_ms.unwrap_or(0);

    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO test_executions (
            id, run_item_id, case_revision_id, attempt_number, status,
            duration_ms, error_message, stack_trace, notes, executed_by
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            exec_id,
            input.run_item_id,
            case_rev_id,
            attempt_number,
            input.status,
            duration_ms,
            input.error_message,
            input.stack_trace,
            input.notes,
            input.executed_by,
        ],
    )?;

    if let Some(steps) = input.step_results {
        for step in steps {
            let step_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO execution_step_results (id, execution_id, step_number, status, actual_result)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![step_id, exec_id, step.step_number, step.status, step.actual_result],
            )?;
        }
    }

    // Update item status
    tx.execute(
        "UPDATE test_run_items SET status = ?1 WHERE id = ?2",
        params![input.status, input.run_item_id],
    )?;

    // Recalculate run aggregates
    let (passed, failed, skipped, blocked, pending): (i64, i64, i64, i64, i64) = tx.query_row(
        "SELECT 
            COALESCE(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
         FROM test_run_items WHERE test_run_id = ?1",
        params![run_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    )?;

    let run_status = if pending == 0 { "completed" } else { "in_progress" };
    let completed_expr = if pending == 0 { "(strftime('%s', 'now'))" } else { "NULL" };

    tx.execute(
        &format!(
            "UPDATE test_runs SET
                passed_count = ?1,
                failed_count = ?2,
                skipped_count = ?3,
                blocked_count = ?4,
                status = ?5,
                completed_at = {completed_expr}
             WHERE id = ?6"
        ),
        params![passed, failed, skipped, blocked, run_status, run_id],
    )?;

    tx.commit()?;

    conn.query_row(
        "SELECT id, run_item_id, case_revision_id, attempt_number, status, duration_ms,
                error_message, stack_trace, notes, executed_by, executed_at
         FROM test_executions WHERE id = ?1",
        params![exec_id],
        |row| {
            Ok(TestExecution {
                id: row.get(0)?,
                run_item_id: row.get(1)?,
                case_revision_id: row.get(2)?,
                attempt_number: row.get(3)?,
                status: row.get(4)?,
                duration_ms: row.get(5)?,
                error_message: row.get(6)?,
                stack_trace: row.get(7)?,
                notes: row.get(8)?,
                executed_by: row.get(9)?,
                executed_at: row.get(10)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("Execution not found: {exec_id}")))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddAttachmentInput {
    #[serde(default)]
    pub execution_id: String,
    pub step_number: Option<i64>,
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub mime_type: String,
}

pub fn add_attachment(
    conn: &Connection,
    input: AddAttachmentInput,
) -> Result<ExecutionAttachment, AppError> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO execution_attachments (
            id, execution_id, step_number, file_name, file_path, file_size_bytes, mime_type
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.execution_id,
            input.step_number,
            input.file_name,
            input.file_path,
            input.file_size_bytes,
            input.mime_type,
        ],
    )?;

    conn.query_row(
        "SELECT id, execution_id, step_number, file_name, file_path, file_size_bytes, mime_type, created_at
         FROM execution_attachments WHERE id = ?1",
        params![id],
        |row| {
            Ok(ExecutionAttachment {
                id: row.get(0)?,
                execution_id: row.get(1)?,
                step_number: row.get(2)?,
                file_name: row.get(3)?,
                file_path: row.get(4)?,
                file_size_bytes: row.get(5)?,
                mime_type: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("Attachment not found: {id}")))
}

pub fn list_attachments(
    conn: &Connection,
    execution_id: &str,
) -> Result<Vec<ExecutionAttachment>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, execution_id, step_number, file_name, file_path, file_size_bytes, mime_type, created_at
         FROM execution_attachments
         WHERE execution_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![execution_id], |row| {
        Ok(ExecutionAttachment {
            id: row.get(0)?,
            execution_id: row.get(1)?,
            step_number: row.get(2)?,
            file_name: row.get(3)?,
            file_path: row.get(4)?,
            file_size_bytes: row.get(5)?,
            mime_type: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

