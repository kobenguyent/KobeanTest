# PRD-01: Test Case Authoring & Management

## 1. Overview
Test case authoring in legacy tools requires clicking through tabs and filling out 15 form fields. In KobeanTest, test authoring feels like writing in **Notion or Obsidian**: clean markdown with inline `/step` blocks.

## 2. Requirements

### Functional Requirements
1. **Three-Pane Architecture**:
   - Left: Collapsible nested Suite Tree (drag-and-drop hierarchy).
   - Center: Virtualized list of test cases with instant multi-filter by tag, priority, and type.
   - Right: Slide-over inspector or full-width markdown editor (no modal dialogs).
2. **Slash Command Step Blocks**:
   - Typing `/step` inserts a structured step with `Action` and `Expected Result`.
   - Typing `/table` inserts a data matrix for parameterized test inputs.
   - Typing `/gherkin` formats BDD steps (`Given`, `When`, `Then`) with syntax highlighting.
3. **Clipboard Image Pasting**:
   - Pasting an image (`Cmd + V`) saves the asset locally to `~/.kobean/media/` and renders an inline thumbnail with click-to-expand.
4. **Auto-Save & Versioning**:
   - Edits persist to local SQLite automatically with debounce (500ms).
   - Each edit increments the test case `version` and writes an immutable entry to `test_case_revisions`.

## 3. Non-Functional Requirements
- Render test editor in < 16ms upon selecting a test case.
- Search queries update results on every keystroke in < 5ms via SQLite FTS5.
