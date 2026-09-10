use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestAttachmentInput {
    pub file_name: String,
    pub mime_type: String,
    pub data_base64: String,
    pub step_number: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IngestCaseResult {
    pub automation_id: String,
    pub title: String,
    #[serde(default)]
    pub suite_path: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    pub status: String,
    #[serde(default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub stack_trace: Option<String>,
    #[serde(default)]
    pub attempt_number: Option<i64>,
    #[serde(default)]
    pub attachments: Option<Vec<IngestAttachmentInput>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IngestBatchInput {
    #[serde(default)]
    pub project_id: String,
    pub idempotency_key: String,
    pub run_name: String,
    #[serde(default)]
    pub commit_sha: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub repo_connection_id: Option<String>,
    #[serde(default)]
    pub github_repo: Option<String>,
    #[serde(default)]
    pub pull_request_number: Option<i64>,
    #[serde(default)]
    pub pull_request_url: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    #[serde(default)]
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

/// Recursively resolves or creates the suite hierarchy for a given path.
/// E.g. `["E2E", "Payments", "Checkout"]` creates:
/// - E2E (parent_id: None)
///   - Payments (parent_id: E2E)
///     - Checkout (parent_id: Payments)
///
/// Returns the leaf suite ID.
pub fn find_or_create_suite_path(
    tx: &rusqlite::Transaction,
    project_id: &str,
    path: &[String],
) -> Result<Option<String>, AppError> {
    find_or_create_suite_path_with_repo(tx, project_id, path, None, None)
}

pub fn find_or_create_suite_path_with_repo(
    tx: &rusqlite::Transaction,
    project_id: &str,
    path: &[String],
    repo_connection_id: Option<&str>,
    github_repo: Option<&str>,
) -> Result<Option<String>, AppError> {
    if path.is_empty() {
        return Ok(None);
    }
    let mut current_parent_id: Option<String> = None;

    for segment in path {
        let title = segment.trim();
        if title.is_empty() {
            continue;
        }

        let existing_id: Option<String> = tx
            .query_row(
                "SELECT id FROM test_suites 
                 WHERE project_id = ?1 AND parent_id IS ?2 AND title = ?3",
                params![project_id, current_parent_id, title],
                |row| row.get(0),
            )
            .optional()?;

        let suite_id = match existing_id {
            Some(id) => id,
            None => {
                let new_id = Uuid::new_v4().to_string();
                let next_pos: i64 = tx.query_row(
                    "SELECT COALESCE(MAX(position), 0) + 1 FROM test_suites 
                     WHERE project_id = ?1 AND parent_id IS ?2",
                    params![project_id, current_parent_id],
                    |row| row.get(0),
                )?;

                tx.execute(
                    "INSERT INTO test_suites (id, project_id, parent_id, title, position, repo_connection_id, github_repo)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![new_id, project_id, current_parent_id, title, next_pos, repo_connection_id, github_repo],
                )?;
                new_id
            }
        };

        current_parent_id = Some(suite_id);
    }

    Ok(current_parent_id)
}

/// Extracts a case number tag for the active project from test title or tags array.
/// Examples: `@LOC-3`, `[LOC-3]`, `LOC-3` (case-insensitive) -> Some(3).
pub fn extract_case_number_from_tag(
    project_key: &str,
    title: &str,
    tags: Option<&[String]>,
) -> Option<i64> {
    let key_upper = project_key.to_uppercase();

    // 1. Check tags array if provided
    if let Some(tag_list) = tags {
        for tag in tag_list {
            let t = tag.trim().to_uppercase();
            let clean = t.trim_start_matches('@').trim_start_matches('[').trim_end_matches(']');
            if let Some(rest) = clean.strip_prefix(&format!("{key_upper}-")) {
                if let Ok(num) = rest.parse::<i64>() {
                    return Some(num);
                }
            }
        }
    }

    // 2. Check title string
    let title_upper = title.to_uppercase();
    let pattern = format!("{key_upper}-");

    let mut search_idx = 0;
    while let Some(found_idx) = title_upper[search_idx..].find(&pattern) {
        let abs_idx = search_idx + found_idx;
        let prefix_ok = if abs_idx == 0 {
            true
        } else {
            let prev_char = title_upper.as_bytes().get(abs_idx.saturating_sub(1));
            matches!(prev_char, Some(b'@' | b'[' | b' ' | b'(' | b'-' | b':'))
        };

        let start_num = abs_idx + pattern.len();
        if prefix_ok && start_num < title_upper.len() {
            let digits: String = title_upper[start_num..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if !digits.is_empty() {
                if let Ok(num) = digits.parse::<i64>() {
                    return Some(num);
                }
            }
        }
        search_idx = abs_idx + pattern.len();
    }

    None
}

pub fn ingest_batch(
    conn: &mut Connection,
    input: IngestBatchInput,
) -> Result<IngestBatchResponse, AppError> {
    let kobean_dir = crate::session::get_kobean_dir();
    let media_dir = crate::media::get_media_dir(&kobean_dir);
    ingest_batch_with_media(conn, input, Some(&media_dir))
}

pub fn ingest_batch_with_media(
    conn: &mut Connection,
    input: IngestBatchInput,
    media_dir: Option<&Path>,
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
    let env = input.environment.as_deref().unwrap_or("ci");

    let tx = conn.transaction()?;

    // Fetch project key for tag-based case matching
    let project_key: Option<String> = tx
        .query_row(
            "SELECT key FROM projects WHERE id = ?1",
            params![input.project_id],
            |row| row.get(0),
        )
        .optional()?;

    // Resolve repo_connection_id from input or matching repo_connections by repo_name
    let mut resolved_repo_connection_id = input.repo_connection_id.clone();
    if resolved_repo_connection_id.is_none() {
        if let Some(ref gh) = input.github_repo {
            resolved_repo_connection_id = tx
                .query_row(
                    "SELECT id FROM repo_connections 
                     WHERE project_id = ?1 AND (lower(repo_name) = lower(?2) OR lower(repo_url) LIKE lower(?3))
                     LIMIT 1",
                    params![input.project_id, gh.trim(), format!("%{}%", gh.trim())],
                    |r| r.get(0),
                )
                .optional()?;
        }
    }

    tx.execute(
        "INSERT INTO test_runs (
            id, project_id, title, environment, source, status,
            idempotency_key, commit_sha, branch,
            repo_connection_id, github_repo, pull_request_number, pull_request_url,
            total_count
        ) VALUES (?1, ?2, ?3, ?4, 'ci', 'in_progress', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            run_id,
            input.project_id,
            input.run_name,
            env,
            input.idempotency_key,
            input.commit_sha,
            input.branch,
            resolved_repo_connection_id,
            input.github_repo,
            input.pull_request_number,
            input.pull_request_url,
            total_results as i64,
        ],
    )?;

    for result in &input.results {
        // Validate status
        let status = match result.status.as_str() {
            "passed" | "failed" | "blocked" | "skipped" => result.status.as_str(),
            _ => "failed",
        };

        // 1. Resolve suite_id from suite_path (linking to repository connection if provisioned)
        let resolved_suite_id = if let Some(ref path) = result.suite_path {
            find_or_create_suite_path_with_repo(
                &tx,
                &input.project_id,
                path,
                resolved_repo_connection_id.as_deref(),
                input.github_repo.as_deref(),
            )?
        } else {
            None
        };

        // 2. Case Matching
        // Priority 1: Match existing test case by tag (@KEY-N)
        let matched_tag_case_id = if let Some(ref pkey) = project_key {
            if let Some(case_num) = extract_case_number_from_tag(pkey, &result.title, result.tags.as_deref()) {
                tx.query_row(
                    "SELECT id FROM test_cases WHERE project_id = ?1 AND case_number = ?2",
                    params![input.project_id, case_num],
                    |row| row.get(0),
                )
                .optional()?
            } else {
                None
            }
        } else {
            None
        };

        let existing_case_id = match matched_tag_case_id {
            Some(id) => Some(id),
            None => {
                // Priority 2: Match by automation_id
                tx.query_row(
                    "SELECT id FROM test_cases WHERE project_id = ?1 AND automation_id = ?2",
                    params![input.project_id, result.automation_id],
                    |row| row.get(0),
                )
                .optional()?
            }
        };

        let case_id = match existing_case_id {
            Some(id) => {
                // If automation_id was null or suite_id was null, backfill them
                if resolved_suite_id.is_some() {
                    tx.execute(
                        "UPDATE test_cases 
                         SET suite_id = COALESCE(suite_id, ?1),
                             automation_id = COALESCE(automation_id, ?2)
                         WHERE id = ?3",
                        params![resolved_suite_id, result.automation_id, id],
                    )?;
                } else {
                    tx.execute(
                        "UPDATE test_cases 
                         SET automation_id = COALESCE(automation_id, ?1)
                         WHERE id = ?2",
                        params![result.automation_id, id],
                    )?;
                }
                id
            }
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

                let tags_json = match &result.tags {
                    Some(t) => serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()),
                    None => "[]".to_string(),
                };

                tx.execute(
                    "INSERT INTO test_cases (
                        id, project_id, suite_id, case_number, title, priority, type,
                        automation_id, steps_json, tags_json, is_flaky, is_archived, version
                    ) VALUES (?1, ?2, ?3, ?4, ?5, 'medium', 'automated', ?6, '[]', ?7, 0, 0, 1)",
                    params![
                        new_case_id,
                        input.project_id,
                        resolved_suite_id,
                        next_num,
                        result.title,
                        result.automation_id,
                        tags_json
                    ],
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

        // Failure screenshot attachments ingestion
        if let Some(ref attachments) = result.attachments {
            if let Some(target_media_dir) = media_dir {
                for att in attachments {
                    let save_input = crate::media::SaveMediaInput {
                        execution_id: exec_id.clone(),
                        step_number: att.step_number,
                        file_name: att.file_name.clone(),
                        mime_type: att.mime_type.clone(),
                        data_base64: att.data_base64.clone(),
                    };
                    // Non-fatal: if attachment fails to save, don't abort entire ingest
                    let _ = crate::media::save_media_file(
                        &tx,
                        target_media_dir,
                        &save_input,
                        crate::media::DEFAULT_MAX_QUOTA_BYTES,
                    );
                }
            }
        }
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
