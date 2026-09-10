pub mod backup;
pub mod cases;
pub mod connections;
pub mod fts;
pub mod ingest;
pub mod migrations;
pub mod projects;
pub mod runs;
pub mod seed;
pub mod suites;

pub use backup::{create_atomic_backup, verify_backup_integrity};
pub use cases::{
    create_case, delete_case, get_case, get_case_revisions, list_cases, update_case,
    CreateCaseInput, ListCasesFilter, UpdateCaseInput,
};
pub use fts::{repopulate_fts_index, sanitize_fts5_query, search_cases, SearchHit};
pub use ingest::{
    find_or_create_suite_path, ingest_batch, ingest_batch_with_media, IngestAttachmentInput,
    IngestBatchInput, IngestBatchResponse, IngestCaseResult,
};

pub use migrations::run_migrations;
pub use projects::{
    create_project, create_workspace, get_project, get_workspace, list_projects,
    list_workspaces,
};
pub use runs::{
    add_attachment, create_run, get_run, get_run_items, list_attachments, list_runs,
    record_execution, AddAttachmentInput, CreateRunInput, RecordExecutionInput,
    RecordStepResultInput, RunItemDetail,
};
pub use connections::{
    create_connection, delete_connection, delete_github_account, find_connection_by_repo,
    get_connection, get_github_account, list_connections, save_github_account, update_connection,
};
pub use seed::seed_starter_data;
pub use suites::{
    create_suite, create_suite_full, delete_suite, get_suite, list_suites, update_suite,
    update_suite_full, CreateSuiteInput, UpdateSuiteInput,
};

