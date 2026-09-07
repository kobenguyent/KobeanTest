use crate::db::runs::{add_attachment, AddAttachmentInput};
use crate::models::ExecutionAttachment;
use crate::error::AppError;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use uuid::Uuid;

pub const DEFAULT_MAX_QUOTA_BYTES: u64 = 10 * 1024 * 1024 * 1024; // 10 GB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveMediaInput {
    #[serde(default)]
    pub execution_id: String,
    pub step_number: Option<i64>,
    pub file_name: String,
    pub mime_type: String,
    pub data_base64: String,
}

pub fn get_media_dir(base_kobean_dir: &Path) -> PathBuf {
    base_kobean_dir.join("media")
}

pub fn init_media_dir(media_dir: &Path) -> Result<(), AppError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true);
        builder.mode(0o700);
        builder.create(media_dir)?;
    }

    #[cfg(not(unix))]
    {
        fs::create_dir_all(media_dir)?;
    }

    Ok(())
}

pub fn calculate_media_dir_size(media_dir: &Path) -> Result<u64, AppError> {
    if !media_dir.exists() {
        return Ok(0);
    }
    let mut total: u64 = 0;
    for entry in fs::read_dir(media_dir)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_file() {
            total = total.saturating_add(metadata.len());
        }
    }
    Ok(total)
}

pub fn enforce_quota(
    media_dir: &Path,
    incoming_bytes: u64,
    max_quota_bytes: u64,
) -> Result<(), AppError> {
    if incoming_bytes > max_quota_bytes {
        return Err(AppError::Validation(format!(
            "Incoming file size ({} bytes) exceeds quota limit ({} bytes)",
            incoming_bytes, max_quota_bytes
        )));
    }

    if !media_dir.exists() {
        return Ok(());
    }

    let mut current_size = calculate_media_dir_size(media_dir)?;
    if current_size.saturating_add(incoming_bytes) <= max_quota_bytes {
        return Ok(());
    }

    // Collect existing files with modified timestamp
    let mut files: Vec<(PathBuf, u64, SystemTime)> = Vec::new();
    for entry in fs::read_dir(media_dir)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_file() {
            let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            files.push((entry.path(), metadata.len(), modified));
        }
    }

    // Sort ascending by modified time: oldest first (LRU)
    files.sort_by_key(|(_, _, modified)| *modified);

    for (path, size, _) in files {
        if current_size.saturating_add(incoming_bytes) <= max_quota_bytes {
            break;
        }
        if let Ok(()) = fs::remove_file(&path) {
            current_size = current_size.saturating_sub(size);
        }
    }

    Ok(())
}

pub fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => ".png",
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        "image/svg+xml" => ".svg",
        "application/pdf" => ".pdf",
        _ => ".bin",
    }
}

pub fn mime_for_extension(filename: &str) -> &'static str {
    let lower = filename.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".pdf") {
        "application/pdf"
    } else {
        "application/octet-stream"
    }
}

pub fn parse_data_url(raw: &str) -> (&str, Option<&str>) {
    if let Some(stripped) = raw.strip_prefix("data:") {
        if let Some((header, body)) = stripped.split_once(";base64,") {
            return (body, Some(header));
        }
    }
    (raw, None)
}

pub fn decode_base64(input: &str) -> Result<Vec<u8>, AppError> {
    let mut clean = String::with_capacity(input.len());
    for c in input.chars() {
        if !c.is_whitespace() {
            clean.push(c);
        }
    }

    let input_bytes = clean.as_bytes();
    let mut out = Vec::with_capacity((input_bytes.len() * 3) / 4);

    fn char_val(b: u8) -> Option<u8> {
        match b {
            b'A'..=b'Z' => Some(b - b'A'),
            b'a'..=b'z' => Some(b - b'a' + 26),
            b'0'..=b'9' => Some(b - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }

    let mut i = 0;
    while i < input_bytes.len() {
        let chunk = &input_bytes[i..];
        if chunk.len() < 4 {
            break;
        }

        let b0 = match char_val(chunk[0]) {
            Some(v) => v,
            None => return Err(AppError::Validation("Invalid base64 character".to_string())),
        };
        let b1 = match char_val(chunk[1]) {
            Some(v) => v,
            None => return Err(AppError::Validation("Invalid base64 character".to_string())),
        };

        let b2 = if chunk[2] == b'=' {
            None
        } else {
            match char_val(chunk[2]) {
                Some(v) => Some(v),
                None => return Err(AppError::Validation("Invalid base64 character".to_string())),
            }
        };

        let b3 = if chunk[3] == b'=' {
            None
        } else {
            match char_val(chunk[3]) {
                Some(v) => Some(v),
                None => return Err(AppError::Validation("Invalid base64 character".to_string())),
            }
        };

        out.push((b0 << 2) | (b1 >> 4));
        if let Some(c2) = b2 {
            out.push(((b1 & 0x0F) << 4) | (c2 >> 2));
            if let Some(c3) = b3 {
                out.push(((c2 & 0x03) << 6) | c3);
            }
        }

        i += 4;
    }

    Ok(out)
}

pub fn save_media_file(
    conn: &Connection,
    media_dir: &Path,
    input: &SaveMediaInput,
    max_quota_bytes: u64,
) -> Result<ExecutionAttachment, AppError> {
    init_media_dir(media_dir)?;

    let (clean_b64, detected_mime) = parse_data_url(&input.data_base64);
    let mime_type = detected_mime.unwrap_or(input.mime_type.as_str());
    let raw_bytes = decode_base64(clean_b64)?;

    enforce_quota(media_dir, raw_bytes.len() as u64, max_quota_bytes)?;

    let id = Uuid::new_v4().to_string();
    let ext = extension_for_mime(mime_type);
    let filename = format!("{id}{ext}");
    let dest_path = media_dir.join(&filename);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&dest_path)?;
        file.write_all(&raw_bytes)?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&dest_path, &raw_bytes)?;
    }

    let attachment_input = AddAttachmentInput {
        execution_id: input.execution_id.clone(),
        step_number: input.step_number,
        file_name: if input.file_name.is_empty() {
            filename.clone()
        } else {
            input.file_name.clone()
        },
        file_path: dest_path.to_string_lossy().to_string(),
        file_size_bytes: raw_bytes.len() as i64,
        mime_type: mime_type.to_string(),
    };

    add_attachment(conn, attachment_input)
}

pub fn read_media_file(media_dir: &Path, filename: &str) -> Result<(Vec<u8>, String), AppError> {
    // Security check: No path traversal!
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(AppError::Validation("Invalid file name (traversal guard)".to_string()));
    }

    let target_path = media_dir.join(filename);
    if !target_path.exists() || !target_path.is_file() {
        return Err(AppError::NotFound(format!("Media file not found: {filename}")));
    }

    let bytes = fs::read(&target_path)?;
    let mime = mime_for_extension(filename);
    Ok((bytes, mime.to_string()))
}
