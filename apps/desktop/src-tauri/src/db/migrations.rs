use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    // 1. Pragmas for performance and concurrency
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;

    // 2. Core Tables
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            key TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(workspace_id, key),
            UNIQUE(id, workspace_id)
        );

        CREATE TABLE IF NOT EXISTS test_suites (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            parent_id TEXT REFERENCES test_suites(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            CHECK(parent_id IS NULL OR parent_id != id),
            UNIQUE(project_id, id),
            UNIQUE(project_id, parent_id, title)
        );
        CREATE INDEX IF NOT EXISTS idx_suites_project_parent ON test_suites(project_id, parent_id);

        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            suite_id TEXT,
            case_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            preconditions TEXT,
            steps_json TEXT NOT NULL DEFAULT '[]',
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
            type TEXT NOT NULL DEFAULT 'manual' CHECK(type IN ('manual', 'automated', 'exploratory', 'bdd')),
            automation_id TEXT,
            tags_json TEXT NOT NULL DEFAULT '[]',
            is_flaky INTEGER NOT NULL DEFAULT 0,
            is_archived INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(project_id, case_number),
            UNIQUE(id, project_id),
            FOREIGN KEY (project_id, suite_id) REFERENCES test_suites(project_id, id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cases_suite ON test_cases(project_id, suite_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_project_automation_id 
            ON test_cases(project_id, automation_id) WHERE automation_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS test_case_revisions (
            id TEXT PRIMARY KEY NOT NULL,
            case_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            title TEXT NOT NULL,
            preconditions TEXT,
            steps_json TEXT NOT NULL,
            created_by TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (case_id, project_id) REFERENCES test_cases(id, project_id) ON DELETE CASCADE,
            UNIQUE(case_id, version)
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS fts5_cases USING fts5(
            case_id UNINDEXED,
            title,
            preconditions,
            steps_text,
            tags_text,
            tokenize='porter unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS trg_cases_ai AFTER INSERT ON test_cases BEGIN
            INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text)
            VALUES (new.id, new.title, coalesce(new.preconditions, ''), new.steps_json, new.tags_json);
            INSERT INTO test_case_revisions(id, case_id, project_id, version, title, preconditions, steps_json, created_at)
            VALUES (hex(randomblob(16)), new.id, new.project_id, new.version, new.title, new.preconditions, new.steps_json, new.created_at);
        END;

        CREATE TRIGGER IF NOT EXISTS trg_cases_ad AFTER DELETE ON test_cases BEGIN
            DELETE FROM fts5_cases WHERE case_id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_cases_au AFTER UPDATE ON test_cases BEGIN
            DELETE FROM fts5_cases WHERE case_id = old.id;
            INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text)
            VALUES (new.id, new.title, coalesce(new.preconditions, ''), new.steps_json, new.tags_json);
            INSERT OR IGNORE INTO test_case_revisions(id, case_id, project_id, version, title, preconditions, steps_json, created_at)
            VALUES (hex(randomblob(16)), new.id, new.project_id, new.version, new.title, new.preconditions, new.steps_json, new.updated_at);
        END;

        CREATE TABLE IF NOT EXISTS test_runs (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            environment TEXT NOT NULL DEFAULT 'local',
            source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'ci', 'scheduled')),
            status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'aborted')),
            idempotency_key TEXT UNIQUE,
            commit_sha TEXT,
            branch TEXT,
            total_count INTEGER NOT NULL DEFAULT 0,
            passed_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            skipped_count INTEGER NOT NULL DEFAULT 0,
            blocked_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            completed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS test_run_items (
            id TEXT PRIMARY KEY NOT NULL,
            test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
            test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE RESTRICT,
            case_revision_id TEXT NOT NULL REFERENCES test_case_revisions(id) ON DELETE RESTRICT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'passed', 'failed', 'blocked', 'skipped')),
            assigned_to TEXT,
            UNIQUE(test_run_id, test_case_id)
        );

        CREATE TABLE IF NOT EXISTS test_executions (
            id TEXT PRIMARY KEY NOT NULL,
            run_item_id TEXT NOT NULL REFERENCES test_run_items(id) ON DELETE CASCADE,
            case_revision_id TEXT NOT NULL REFERENCES test_case_revisions(id) ON DELETE RESTRICT,
            attempt_number INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'blocked', 'skipped')),
            duration_ms INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            stack_trace TEXT,
            notes TEXT,
            executed_by TEXT,
            executed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            UNIQUE(run_item_id, attempt_number)
        );

        CREATE TABLE IF NOT EXISTS execution_step_results (
            id TEXT PRIMARY KEY NOT NULL,
            execution_id TEXT NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
            step_number INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'blocked', 'skipped')),
            actual_result TEXT,
            UNIQUE(execution_id, step_number)
        );

        CREATE TABLE IF NOT EXISTS execution_attachments (
            id TEXT PRIMARY KEY NOT NULL,
            execution_id TEXT NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
            step_number INTEGER,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(execution_id, step_number) REFERENCES execution_step_results(execution_id, step_number) ON DELETE SET NULL
        );",
    )?;

    Ok(())
}
