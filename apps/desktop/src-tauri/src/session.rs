use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionInfo {
    pub token: String,
    pub port: u16,
    pub pid: u32,
    pub created_at: i64,
}

pub fn get_kobean_dir() -> PathBuf {
    if let Ok(custom) = std::env::var("KOBEAN_HOME") {
        return PathBuf::from(custom);
    }

    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".kobean")
    } else {
        PathBuf::from(".kobean")
    }
}

pub fn init_kobean_dir(dir: &Path) -> Result<(), AppError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true);
        builder.mode(0o700);
        builder.create(dir)?;
    }

    #[cfg(not(unix))]
    {
        fs::create_dir_all(dir)?;
    }

    Ok(())
}

pub fn create_session(dir: &Path, port: u16) -> Result<SessionInfo, AppError> {
    init_kobean_dir(dir)?;

    let token = Uuid::new_v4().to_string();
    let pid = std::process::id();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let session = SessionInfo {
        token,
        port,
        pid,
        created_at,
    };

    let session_path = dir.join("session.json");
    let json_bytes = serde_json::to_vec_pretty(&session)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&session_path)?;
        file.write_all(&json_bytes)?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&session_path, &json_bytes)?;
    }

    Ok(session)
}

pub fn read_session(dir: &Path) -> Result<SessionInfo, AppError> {
    let session_path = dir.join("session.json");
    if !session_path.exists() {
        return Err(AppError::NotFound("Session file not found".to_string()));
    }

    let content = fs::read_to_string(&session_path)?;
    let session: SessionInfo = serde_json::from_str(&content)?;
    Ok(session)
}

pub fn validate_token(expected: &str, provided: &str) -> bool {
    if expected.len() != provided.len() {
        return false;
    }
    // Constant time comparison
    let mut diff = 0u8;
    for (a, b) in expected.bytes().zip(provided.bytes()) {
        diff |= a ^ b;
    }
    diff == 0
}
