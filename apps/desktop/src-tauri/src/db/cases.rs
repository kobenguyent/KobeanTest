use crate::error::AppError;
use crate::models::{TestCase, TestCaseRevision};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCaseInput {
    pub project_id: String,
    pub suite_id: Option<String>,
    pub title: String,
    pub preconditions: Option<String>,
    pub steps_json: Option<String>,
    pub priority: Option<String>,
    pub type_: Option<String>,
    pub automation_id: Option<String>,
    pub tags_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCaseInput {
    pub suite_id: Option<String>,
    pub title: String,
    pub preconditions: Option<String>,
    pub steps_json: Option<String>,
    pub priority: Option<String>,
    pub type_: Option<String>,
    pub automation_id: Option<String>,
    pub tags_json: Option<String>,
    pub is_flaky: Option<bool>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ListCasesFilter {
    pub project_id: String,
    pub suite_id: Option<String>,
    pub priority: Option<String>,
    pub type_: Option<String>,
    pub is_archived: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn create_case(conn: &Connection, input: CreateCaseInput) -> Result<TestCase, AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Test case title cannot be empty".to_string()));
    }

    let id = Uuid::new_v4().to_string();
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let type_ = input.type_.unwrap_or_else(|| "manual".to_string());
    let steps_json = input.steps_json.unwrap_or_else(|| "[]".to_string());
    let tags_json = input.tags_json.unwrap_or_else(|| "[]".to_string());

    // Next case number within project
    let case_number: i64 = conn.query_row(
        "SELECT COALESCE(MAX(case_number), 0) + 1 FROM test_cases WHERE project_id = ?1",
        params![input.project_id],
        |row| row.get(0),
    )?;

    conn.execute(
        "INSERT INTO test_cases (
            id, project_id, suite_id, case_number, title, preconditions,
            steps_json, priority, type, automation_id, tags_json,
            is_flaky, is_archived, version
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, 0, 1
        )",
        params![
            id,
            input.project_id,
            input.suite_id,
            case_number,
            input.title,
            input.preconditions,
            steps_json,
            priority,
            type_,
            input.automation_id,
            tags_json,
        ],
    )?;

    get_case(conn, &id)
}

pub fn get_case(conn: &Connection, id: &str) -> Result<TestCase, AppError> {
    conn.query_row(
        "SELECT id, project_id, suite_id, case_number, title, preconditions,
                steps_json, priority, type, automation_id, tags_json,
                is_flaky, is_archived, version, created_at, updated_at
         FROM test_cases WHERE id = ?1",
        params![id],
        |row| {
            Ok(TestCase {
                id: row.get(0)?,
                project_id: row.get(1)?,
                suite_id: row.get(2)?,
                case_number: row.get(3)?,
                title: row.get(4)?,
                preconditions: row.get(5)?,
                steps_json: row.get(6)?,
                priority: row.get(7)?,
                type_: row.get(8)?,
                automation_id: row.get(9)?,
                tags_json: row.get(10)?,
                is_flaky: row.get::<_, i64>(11)? != 0,
                is_archived: row.get::<_, i64>(12)? != 0,
                version: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound(format!("TestCase not found: {id}")))
}

pub fn update_case(conn: &Connection, id: &str, input: UpdateCaseInput) -> Result<TestCase, AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Test case title cannot be empty".to_string()));
    }

    let existing = get_case(conn, id)?;
    let new_version = existing.version + 1;
    let priority = input.priority.unwrap_or(existing.priority);
    let type_ = input.type_.unwrap_or(existing.type_);
    let steps_json = input.steps_json.unwrap_or(existing.steps_json);
    let tags_json = input.tags_json.unwrap_or(existing.tags_json);
    let is_flaky = input.is_flaky.unwrap_or(existing.is_flaky);
    let is_archived = input.is_archived.unwrap_or(existing.is_archived);

    conn.execute(
        "UPDATE test_cases SET
            suite_id = ?1,
            title = ?2,
            preconditions = ?3,
            steps_json = ?4,
            priority = ?5,
            type = ?6,
            automation_id = ?7,
            tags_json = ?8,
            is_flaky = ?9,
            is_archived = ?10,
            version = ?11,
            updated_at = (strftime('%s', 'now'))
         WHERE id = ?12",
        params![
            input.suite_id,
            input.title,
            input.preconditions,
            steps_json,
            priority,
            type_,
            input.automation_id,
            tags_json,
            if is_flaky { 1 } else { 0 },
            if is_archived { 1 } else { 0 },
            new_version,
            id,
        ],
    )?;

    get_case(conn, id)
}

pub fn delete_case(conn: &Connection, id: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM test_cases WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("TestCase not found: {id}")));
    }
    Ok(())
}

pub fn list_cases(conn: &Connection, filter: ListCasesFilter) -> Result<Vec<TestCase>, AppError> {
    let mut query = String::from(
        "SELECT id, project_id, suite_id, case_number, title, preconditions,
                steps_json, priority, type, automation_id, tags_json,
                is_flaky, is_archived, version, created_at, updated_at
         FROM test_cases
         WHERE project_id = ?1",
    );
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(filter.project_id)];

    if let Some(suite_id) = filter.suite_id {
        query.push_str(" AND suite_id = ?");
        params_vec.push(Box::new(suite_id));
    }
    if let Some(priority) = filter.priority {
        query.push_str(" AND priority = ?");
        params_vec.push(Box::new(priority));
    }
    if let Some(type_) = filter.type_ {
        query.push_str(" AND type = ?");
        params_vec.push(Box::new(type_));
    }
    if let Some(is_archived) = filter.is_archived {
        query.push_str(" AND is_archived = ?");
        params_vec.push(Box::new(if is_archived { 1 } else { 0 }));
    }

    query.push_str(" ORDER BY case_number ASC");

    if let Some(limit) = filter.limit {
        query.push_str(&format!(" LIMIT {limit}"));
        if let Some(offset) = filter.offset {
            query.push_str(&format!(" OFFSET {offset}"));
        }
    }

    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(TestCase {
            id: row.get(0)?,
            project_id: row.get(1)?,
            suite_id: row.get(2)?,
            case_number: row.get(3)?,
            title: row.get(4)?,
            preconditions: row.get(5)?,
            steps_json: row.get(6)?,
            priority: row.get(7)?,
            type_: row.get(8)?,
            automation_id: row.get(9)?,
            tags_json: row.get(10)?,
            is_flaky: row.get::<_, i64>(11)? != 0,
            is_archived: row.get::<_, i64>(12)? != 0,
            version: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}

pub fn get_case_revisions(conn: &Connection, case_id: &str) -> Result<Vec<TestCaseRevision>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, case_id, project_id, version, title, preconditions, steps_json, created_by, created_at
         FROM test_case_revisions
         WHERE case_id = ?1
         ORDER BY version DESC",
    )?;
    let rows = stmt.query_map(params![case_id], |row| {
        Ok(TestCaseRevision {
            id: row.get(0)?,
            case_id: row.get(1)?,
            project_id: row.get(2)?,
            version: row.get(3)?,
            title: row.get(4)?,
            preconditions: row.get(5)?,
            steps_json: row.get(6)?,
            created_by: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    let mut list = Vec::new();
    for item in rows {
        list.push(item?);
    }
    Ok(list)
}
