use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchHit {
    pub case_id: String,
    pub title: String,
    pub preconditions: String,
    pub rank: f64,
}

pub fn search_cases(conn: &Connection, query: &str, limit: u32) -> Result<Vec<SearchHit>> {
    let sanitized_query = query.trim().replace('"', "\"\"");
    if sanitized_query.is_empty() {
        return Ok(Vec::new());
    }

    // FTS5 MATCH with BM25 ranking
    let fts_query = format!("\"{}\"*", sanitized_query);
    let mut stmt = conn.prepare(
        "SELECT case_id, title, preconditions, rank
         FROM fts5_cases
         WHERE fts5_cases MATCH ?1
         ORDER BY rank
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(params![fts_query, limit], |row| {
        Ok(SearchHit {
            case_id: row.get(0)?,
            title: row.get(1)?,
            preconditions: row.get(2)?,
            rank: row.get(3)?,
        })
    })?;

    let mut results = Vec::new();
    for hit in rows {
        results.push(hit?);
    }

    Ok(results)
}

/// Authoritative Repopulation Procedure
/// Restores complete FTS5 index from canonical test_cases table
pub fn repopulate_fts_index(conn: &Connection) -> Result<usize> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM fts5_cases;", [])?;
    let count = tx.execute(
        "INSERT INTO fts5_cases(case_id, title, preconditions, steps_text, tags_text)
         SELECT id, title, coalesce(preconditions, ''), steps_json, tags_json
         FROM test_cases
         WHERE is_archived = 0;",
        [],
    )?;
    tx.commit()?;
    Ok(count)
}
