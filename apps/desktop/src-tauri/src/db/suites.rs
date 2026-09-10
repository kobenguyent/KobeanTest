use crate::error::AppError;
use crate::models::TestSuite;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CreateSuiteInput {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub position: Option<i64>,
    pub repo_connection_id: Option<String>,
    pub github_repo: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateSuiteInput {
    pub title: String,
    pub description: Option<String>,
    pub parent_id: Option<String>,
    pub position: Option<i64>,
    pub repo_connection_id: Option<String>,
    pub github_repo: Option<String>,
    pub file_path: Option<String>,
}

pub fn create_suite_full(
    conn: &Connection,
    input: CreateSuiteInput,
) -> Result<TestSuite, AppError> {
    let id = Uuid::new_v4().to_string();
    let pos = input.position.unwrap_or(0);

    conn.execute(
        "INSERT INTO test_suites (
            id, project_id, parent_id, title, description, position,
            repo_connection_id, github_repo, file_path
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            input.project_id,
            input.parent_id,
            input.title,
            input.description,
            pos,
            input.repo_connection_id,
            input.github_repo,
            input.file_path
        ],
    )?;

    get_suite(conn, &id)
}

pub fn create_suite(
    conn: &Connection,
    project_id: &str,
    parent_id: Option<&str>,
    title: &str,
    description: Option<&str>,
    position: Option<i64>,
) -> Result<TestSuite, AppError> {
    create_suite_full(
        conn,
        CreateSuiteInput {
            project_id: project_id.to_string(),
            parent_id: parent_id.map(String::from),
            title: title.to_string(),
            description: description.map(String::from),
            position,
            ..Default::default()
        },
    )
}

pub fn get_suite(conn: &Connection, id: &str) -> Result<TestSuite, AppError> {
    conn.query_row(
        "SELECT id, project_id, parent_id, title, description, position,
                repo_connection_id, github_repo, file_path, created_at, updated_at
         FROM test_suites WHERE id = ?1",
        params![id],
        |row| {
            Ok(TestSuite {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                position: row.get(5)?,
                repo_connection_id: row.get(6)?,
                github_repo: row.get(7)?,
                file_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("TestSuite not found: {id}")))
}

pub fn list_suites(conn: &Connection, project_id: &str) -> Result<Vec<TestSuite>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, parent_id, title, description, position,
                repo_connection_id, github_repo, file_path, created_at, updated_at
         FROM test_suites
         WHERE project_id = ?1
         ORDER BY position ASC, created_at ASC",
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(TestSuite {
            id: row.get(0)?,
            project_id: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            position: row.get(5)?,
            repo_connection_id: row.get(6)?,
            github_repo: row.get(7)?,
            file_path: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn update_suite_full(
    conn: &Connection,
    id: &str,
    input: UpdateSuiteInput,
) -> Result<TestSuite, AppError> {
    if let Some(ref pid) = input.parent_id {
        if pid == id {
            return Err(AppError::Validation("A suite cannot be its own parent".to_string()));
        }
    }

    let current = get_suite(conn, id)?;
    let new_pos = input.position.unwrap_or(current.position);

    conn.execute(
        "UPDATE test_suites 
         SET title = ?1, description = ?2, parent_id = ?3, position = ?4,
             repo_connection_id = ?5, github_repo = ?6, file_path = ?7,
             updated_at = (strftime('%s', 'now'))
         WHERE id = ?8",
        params![
            input.title,
            input.description,
            input.parent_id,
            new_pos,
            input.repo_connection_id,
            input.github_repo,
            input.file_path,
            id
        ],
    )?;

    get_suite(conn, id)
}

pub fn update_suite(
    conn: &Connection,
    id: &str,
    title: &str,
    description: Option<&str>,
    parent_id: Option<&str>,
    position: Option<i64>,
) -> Result<TestSuite, AppError> {
    let current = get_suite(conn, id)?;
    update_suite_full(
        conn,
        id,
        UpdateSuiteInput {
            title: title.to_string(),
            description: description.map(String::from),
            parent_id: parent_id.map(String::from),
            position,
            repo_connection_id: current.repo_connection_id,
            github_repo: current.github_repo,
            file_path: current.file_path,
        },
    )
}

pub fn delete_suite(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM test_suites WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("TestSuite not found: {id}")));
    }
    Ok(())
}
