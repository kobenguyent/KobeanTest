use crate::error::AppError;
use crate::models::{GitHubAccount, RepoConnection};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub fn get_github_account(conn: &Connection) -> Result<Option<GitHubAccount>, AppError> {
    conn.query_row(
        "SELECT id, login, name, avatar_url, token_masked, created_at, updated_at
         FROM github_accounts ORDER BY created_at DESC LIMIT 1",
        [],
        |row| {
            Ok(GitHubAccount {
                id: row.get(0)?,
                login: row.get(1)?,
                name: row.get(2)?,
                avatar_url: row.get(3)?,
                token_masked: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .optional()
    .map_err(AppError::from)
}

pub fn save_github_account(
    conn: &Connection,
    login: &str,
    name: Option<&str>,
    avatar_url: Option<&str>,
    token: &str,
) -> Result<GitHubAccount, AppError> {
    conn.execute("DELETE FROM github_accounts", [])?;

    let id = Uuid::new_v4().to_string();
    let token_trimmed = token.trim();
    let token_masked = if token_trimmed.len() > 10 {
        format!("{}...{}", &token_trimmed[..6], &token_trimmed[token_trimmed.len() - 4..])
    } else {
        "ghp_****".to_string()
    };

    conn.execute(
        "INSERT INTO github_accounts (id, login, name, avatar_url, token_masked, access_token)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, login.trim(), name, avatar_url, token_masked, token_trimmed],
    )?;

    get_github_account(conn)?
        .ok_or_else(|| AppError::NotFound("Failed to retrieve saved GitHub account".to_string()))
}

pub fn delete_github_account(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM github_accounts", [])?;
    Ok(())
}

pub fn create_connection(
    conn: &Connection,
    project_id: &str,
    name: &str,
    repo_name: &str,
    repo_url: &str,
    default_branch: Option<&str>,
) -> Result<RepoConnection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Validation("Connection name cannot be empty".to_string()));
    }
    if repo_name.trim().is_empty() {
        return Err(AppError::Validation("Repository name cannot be empty".to_string()));
    }
    if repo_url.trim().is_empty() {
        return Err(AppError::Validation("Repository URL cannot be empty".to_string()));
    }

    let id = Uuid::new_v4().to_string();
    let branch = default_branch.unwrap_or("main").trim();
    let branch_str = if branch.is_empty() { "main" } else { branch };

    conn.execute(
        "INSERT INTO repo_connections (id, project_id, name, provider, repo_name, repo_url, default_branch)
         VALUES (?1, ?2, ?3, 'github', ?4, ?5, ?6)",
        params![id, project_id, name.trim(), repo_name.trim(), repo_url.trim(), branch_str],
    )?;

    get_connection(conn, &id)
}

pub fn get_connection(conn: &Connection, id: &str) -> Result<RepoConnection, AppError> {
    conn.query_row(
        "SELECT id, project_id, name, provider, repo_name, repo_url, default_branch, created_at, updated_at
         FROM repo_connections WHERE id = ?1",
        params![id],
        |row| {
            Ok(RepoConnection {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                provider: row.get(3)?,
                repo_name: row.get(4)?,
                repo_url: row.get(5)?,
                default_branch: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("RepoConnection not found: {id}")))
}

pub fn list_connections(conn: &Connection, project_id: &str) -> Result<Vec<RepoConnection>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, provider, repo_name, repo_url, default_branch, created_at, updated_at
         FROM repo_connections
         WHERE project_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(RepoConnection {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            provider: row.get(3)?,
            repo_name: row.get(4)?,
            repo_url: row.get(5)?,
            default_branch: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn update_connection(
    conn: &Connection,
    id: &str,
    name: &str,
    repo_name: &str,
    repo_url: &str,
    default_branch: Option<&str>,
) -> Result<RepoConnection, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::Validation("Connection name cannot be empty".to_string()));
    }
    if repo_name.trim().is_empty() {
        return Err(AppError::Validation("Repository name cannot be empty".to_string()));
    }
    if repo_url.trim().is_empty() {
        return Err(AppError::Validation("Repository URL cannot be empty".to_string()));
    }

    let branch = default_branch.unwrap_or("main").trim();
    let branch_str = if branch.is_empty() { "main" } else { branch };

    conn.execute(
        "UPDATE repo_connections 
         SET name = ?1, repo_name = ?2, repo_url = ?3, default_branch = ?4, updated_at = (strftime('%s', 'now'))
         WHERE id = ?5",
        params![name.trim(), repo_name.trim(), repo_url.trim(), branch_str, id],
    )?;

    get_connection(conn, id)
}

pub fn delete_connection(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM repo_connections WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("RepoConnection not found: {id}")));
    }
    Ok(())
}

pub fn find_connection_by_repo(
    conn: &Connection,
    project_id: &str,
    repo_name: &str,
) -> Result<Option<RepoConnection>, AppError> {
    conn.query_row(
        "SELECT id, project_id, name, provider, repo_name, repo_url, default_branch, created_at, updated_at
         FROM repo_connections
         WHERE project_id = ?1 AND (lower(repo_name) = lower(?2) OR lower(repo_url) LIKE lower(?3))
         LIMIT 1",
        params![project_id, repo_name.trim(), format!("%{}%", repo_name.trim())],
        |row| {
            Ok(RepoConnection {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                provider: row.get(3)?,
                repo_name: row.get(4)?,
                repo_url: row.get(5)?,
                default_branch: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .optional()
    .map_err(AppError::from)
}
