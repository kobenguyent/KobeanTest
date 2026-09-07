# Security & Isolation Standards — KobeanTest

Security rules for desktop native hooks, local storage, and web content.

## 1. Localhost Attack Surface & Sandboxing
- In Tauri v2, the webview runs in an OS-native sandbox without Node.js integration.
- The webview can NEVER execute arbitrary shell commands.
- Local SQLite database permissions are restricted to the current OS user (`0700`).

## 2. XSS & Content Sanitization
- Test cases, descriptions, and execution notes often contain code snippets, HTML tags, and raw logs.
- All rendered markdown, TipTap HTML, and Gherkin steps MUST pass through **DOMPurify** before injection into the DOM.
- Use strict Content Security Policy (CSP):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*;`

## 3. Secret & Credential Handling
- Never store API keys, tokens, or passwords in plaintext `localStorage`.
- Use the native OS Keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) via Rust `keyring` crate for any external tokens (e.g. Jira API tokens).
- Pre-commit scanning via **Betterleaks** (`.betterleaks.toml`) blocks accidental secret commits.
