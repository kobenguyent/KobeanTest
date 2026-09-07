# PRD-02: Native Desktop Floating Mini-HUD

## 1. Overview
When testers perform manual exploratory testing on external applications (e.g. testing an iOS app on Simulator, an Android app on emulator, or a desktop app), having to switch windows to mark tests passed/failed breaks flow. The Floating Mini-HUD solves this with an always-on-top compact runner.

## 2. Requirements

### Functional Requirements
1. **Multi-Window Tauri HUD**:
   - Triggered via `Cmd + Shift + F` or "Float Runner" button.
   - Spawns a secondary, lightweight Tauri window (360px wide, ~220px tall).
   - Configured with `always_on_top: true` and subtle rounded glass styling (`backdrop-blur`).
2. **Step Navigation & Hotkeys**:
   - Displays: Test Case ID, Title, Current Step index (`Step 2 of 4`), Action, and Expected Result.
   - Global or focused hotkeys:
     - `P`: Mark current test passed and advance to next.
     - `F`: Mark test failed, prompt for defect note.
     - `S`: Skip test.
     - `[` / `]`: Move between previous and next test cases.
3. **Instant Screen Snapping**:
   - `[📸 Snap]` button or global hotkey captures the screen and automatically attaches it to the current failed step.

## 3. Non-Functional Requirements
- Idle RAM footprint of the HUD window must remain < 20MB.
- State between main window and HUD must synchronize in < 5ms via local event bus.
