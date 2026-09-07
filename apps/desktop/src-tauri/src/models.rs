use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Project {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub key: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestSuite {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub position: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestCase {
    pub id: String,
    pub project_id: String,
    pub suite_id: Option<String>,
    pub case_number: i64,
    pub title: String,
    pub preconditions: Option<String>,
    pub steps_json: String,
    pub priority: String,
    pub type_: String,
    pub automation_id: Option<String>,
    pub tags_json: String,
    pub is_flaky: bool,
    pub is_archived: bool,
    pub version: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestCaseRevision {
    pub id: String,
    pub case_id: String,
    pub project_id: String,
    pub version: i64,
    pub title: String,
    pub preconditions: Option<String>,
    pub steps_json: String,
    pub created_by: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestRun {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub environment: String,
    pub source: String,
    pub status: String,
    pub idempotency_key: Option<String>,
    pub commit_sha: Option<String>,
    pub branch: Option<String>,
    pub total_count: i64,
    pub passed_count: i64,
    pub failed_count: i64,
    pub skipped_count: i64,
    pub blocked_count: i64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestRunItem {
    pub id: String,
    pub test_run_id: String,
    pub test_case_id: String,
    pub case_revision_id: String,
    pub status: String,
    pub assigned_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestExecution {
    pub id: String,
    pub run_item_id: String,
    pub case_revision_id: String,
    pub attempt_number: i64,
    pub status: String,
    pub duration_ms: i64,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
    pub notes: Option<String>,
    pub executed_by: Option<String>,
    pub executed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExecutionStepResult {
    pub id: String,
    pub execution_id: String,
    pub step_number: i64,
    pub status: String,
    pub actual_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExecutionAttachment {
    pub id: String,
    pub execution_id: String,
    pub step_number: Option<i64>,
    pub file_name: String,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub mime_type: String,
    pub created_at: i64,
}
