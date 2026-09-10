import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LAYOUT_STATE,
  LAYOUT_PRESETS,
  LAYOUT_STORAGE_KEY,
  getLayoutShortcutLabels,
  getPanelAriaLabel,
} from '../src/layout-state.ts';

test('DEFAULT_LAYOUT_STATE provides expected initial panel visibility', () => {
  assert.equal(DEFAULT_LAYOUT_STATE.showLeftSidebar, true, 'Primary left sidebar should default to open');
  assert.equal(DEFAULT_LAYOUT_STATE.showBottomPanel, false, 'Bottom panel should default to closed');
  assert.equal(DEFAULT_LAYOUT_STATE.showRightSidebar, true, 'Secondary right sidebar should default to open');
  assert.equal(LAYOUT_STORAGE_KEY, 'kobean_layout_state');
});

test('LAYOUT_PRESETS defines valid states for all standard layout configurations', () => {
  const presetKeys = Object.keys(LAYOUT_PRESETS);
  assert.ok(presetKeys.includes('default'), 'Default preset must exist');
  assert.ok(presetKeys.includes('zen'), 'Zen preset must exist');
  assert.ok(presetKeys.includes('triage'), 'Triage preset must exist');
  assert.ok(presetKeys.includes('bottom-focus'), 'Bottom-focus preset must exist');

  // Zen mode: all sidebars/panels closed
  const zen = LAYOUT_PRESETS.zen.state;
  assert.equal(zen.showLeftSidebar, false);
  assert.equal(zen.showBottomPanel, false);
  assert.equal(zen.showRightSidebar, false);

  // Triage mode: all sidebars and console panel open
  const triage = LAYOUT_PRESETS.triage.state;
  assert.equal(triage.showLeftSidebar, true);
  assert.equal(triage.showBottomPanel, true);
  assert.equal(triage.showRightSidebar, true);
});

test('getLayoutShortcutLabels returns platform-aware modifier keys', () => {
  const macShortcuts = getLayoutShortcutLabels(true);
  assert.equal(macShortcuts.leftSidebar, '⌘B');
  assert.equal(macShortcuts.bottomPanel, '⌘J');
  assert.equal(macShortcuts.rightSidebar, '⌥⌘B');

  const winShortcuts = getLayoutShortcutLabels(false);
  assert.equal(winShortcuts.leftSidebar, 'Ctrl+B');
  assert.equal(winShortcuts.bottomPanel, 'Ctrl+J');
  assert.equal(winShortcuts.rightSidebar, 'Alt+Ctrl+B');
});

test('getPanelAriaLabel provides accessible descriptive labels for each toggle button', () => {
  const macLeft = getPanelAriaLabel('left', true, true);
  assert.ok(macLeft.includes('Toggle Primary Side Bar'));
  assert.ok(macLeft.includes('⌘B'));

  const macBottom = getPanelAriaLabel('bottom', false, true);
  assert.ok(macBottom.includes('Toggle Bottom Panel'));
  assert.ok(macBottom.includes('⌘J'));

  const winRight = getPanelAriaLabel('right', true, false);
  assert.ok(winRight.includes('Toggle Secondary Side Bar'));
  assert.ok(winRight.includes('Alt+Ctrl+B'));
});
