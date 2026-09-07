use crate::error::AppError;
use crate::models::TestSuite;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn create_suite(
    conn: &Connection,
    project_id: &str,
    parent_id: Option<&str>,
    title: &str,
    description: Option<&str>,
    position: Option<i64>,
) -> Result<TestSuite, AppError> {
    let id = Uuid::new_v4().to_string();
    let pos = position.unwrap_or(0);

    conn.execute(
        "INSERT INTO test_suites (id, project_id, parent_id, title, description, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, project_id, parent_id, title, description, pos],
    )?;

    get_suite(conn, &id)
}

pub fn get_suite(conn: &Connection, id: &str) -> Result<TestSuite, AppError> {
    conn.query_row(
        "SELECT id, project_id, parent_id, title, description, position, created_at, updated_at
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
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("TestSuite not found: {id}")))
}

pub fn list_suites(conn: &Connection, project_id: &str) -> Result<Vec<TestSuite>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, parent_id, title, description, position, created_at, updated_at
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
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn update_suite(
    conn: &Connection,
    id: &str,
    title: &str,
    description: Option<&str>,
    parent_id: Option<&str>,
    position: Option<i64>,
) -> Result<TestSuite, AppError> {
    if let Some(pid) = parent_id {
        if pid == id {
            return Err(AppError::Validation("A suite cannot be its own parent".to_string()));
        }
    }

    let current = get_suite(conn, id)?;
    let new_pos = position.unwrap_or(current.position);

    conn.execute(
        "UPDATE test_suites 
         SET title = ?1, description = ?2, parent_id = ?3, position = ?4, updated_at = (strftime('%s', 'now'))
         WHERE id = ?5",
        params![title, description, parent_id, new_pos, id],
    )?;

    get_suite(conn, id)
}

pub fn delete_suite(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM test_suites WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("TestSuite not found: {id}")));
    }
    Ok(())
}
