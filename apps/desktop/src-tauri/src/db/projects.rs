use crate::error::AppError;
use crate::models::{Project, Workspace};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn create_workspace(conn: &Connection, name: &str, slug: &str) -> Result<Workspace, AppError> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO workspaces (id, name, slug) VALUES (?1, ?2, ?3)",
        params![id, name, slug],
    )?;

    get_workspace(conn, &id)
}

pub fn get_workspace(conn: &Connection, id: &str) -> Result<Workspace, AppError> {
    conn.query_row(
        "SELECT id, name, slug, created_at, updated_at FROM workspaces WHERE id = ?1",
        params![id],
        |row| {
            Ok(Workspace {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("Workspace not found: {id}")))
}

pub fn list_workspaces(conn: &Connection) -> Result<Vec<Workspace>, AppError> {
    let mut stmt = conn.prepare("SELECT id, name, slug, created_at, updated_at FROM workspaces ORDER BY created_at ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            slug: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn create_project(
    conn: &Connection,
    workspace_id: &str,
    name: &str,
    key: &str,
    description: Option<&str>,
) -> Result<Project, AppError> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO projects (id, workspace_id, name, key, description) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, workspace_id, name, key, description],
    )?;

    get_project(conn, &id)
}

pub fn get_project(conn: &Connection, id: &str) -> Result<Project, AppError> {
    conn.query_row(
        "SELECT id, workspace_id, name, key, description, created_at, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                name: row.get(2)?,
                key: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("Project not found: {id}")))
}

pub fn list_projects(conn: &Connection, workspace_id: &str) -> Result<Vec<Project>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, key, description, created_at, updated_at 
         FROM projects 
         WHERE workspace_id = ?1 
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![workspace_id], |row| {
        Ok(Project {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            name: row.get(2)?,
            key: row.get(3)?,
            description: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}
