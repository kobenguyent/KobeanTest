use kobean_core::session::{create_session, read_session, validate_token};
use tempfile::tempdir;

#[test]
fn test_session_lifecycle_and_permissions() {
    let tmp = tempdir().expect("Create tempdir");
    let session_dir = tmp.path().join(".kobean");

    let session = create_session(&session_dir, 4000).expect("Create session");
    assert_eq!(session.port, 4000);
    assert!(!session.token.is_empty());

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let dir_meta = std::fs::metadata(&session_dir).expect("Dir metadata");
        let dir_mode = dir_meta.permissions().mode() & 0o777;
        assert_eq!(dir_mode, 0o700, "Directory must have 0700 permissions");

        let file_meta = std::fs::metadata(session_dir.join("session.json")).expect("File metadata");
        let file_mode = file_meta.permissions().mode() & 0o777;
        assert_eq!(file_mode, 0o600, "Session file must have 0600 permissions");
    }

    let read_back = read_session(&session_dir).expect("Read session");
    assert_eq!(session, read_back);

    assert!(validate_token(&session.token, &session.token));
    assert!(!validate_token(&session.token, "invalid-token"));
    assert!(!validate_token(&session.token, &session.token[..session.token.len() - 1]));
}
