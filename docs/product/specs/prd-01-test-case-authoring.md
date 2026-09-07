# PRD-01: Test Case Authoring & Management

## 1. Overview
Test case authoring in legacy tools requires clicking through tabs and filling out 15 form fields. In KobeanTest, test authoring feels like writing in **Notion or Obsidian**: clean markdown with inline `/step` blocks.

## 2. Requirements

### Functional Requirements
1. **Three-Pane Architecture**:
   - Left: Collapsible nested Suite Tree (drag-and-drop hierarchy with cycle protection `parent_id != id`).
   - Center: Virtualized list of test cases with instant multi-filter by tag, priority, and type.
   - Right: Slide-over inspector or full-width markdown editor (no modal dialogs).
2. **Slash Command Step Blocks**:
   - Typing `/step` inserts a structured step with `Action` and `Expected Result`.
   - Typing `/table` inserts a data matrix for parameterized test inputs.
   - Typing `/gherkin` formats BDD steps (`Given`, `When`, `Then`) with syntax highlighting.
3. **Clipboard Image Pasting**:
   - Pasting an image (`Cmd + V`) saves the asset locally to `~/.kobean/media/` and renders an inline thumbnail with click-to-expand.
4. **Immutable Versioning & Draft Autosave**:
   - Typing writes immediately to local `sessionStorage` draft recovery.
   - Debounce (500ms) commits changes to `test_cases` and automatically generates a new record in `test_case_revisions`.
   - Before window close, a flush handler commits any active draft to SQLite to prevent data loss.
5. **Archival & Soft Deletion**:
   - Deleting a test case marks `is_archived = 1`.
   - Historical test runs continue to reference the immutable `test_case_revisions` record so past execution history is never destroyed.

## 3. Non-Functional Requirements
- Render test editor in < 16ms upon selecting a test case.
- Search queries update results on every keystroke in < 5ms via SQLite FTS5.
