import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, STATUS_STYLES } from '../src/tokens.ts';

test('Theme definitions guarantee WCAG AAA contrast ratios', () => {
  const themeKeys = Object.keys(THEMES);
  assert.equal(themeKeys.length, 4);

  for (const [id, def] of Object.entries(THEMES)) {
    assert.ok(def.id, `Theme ${id} must have id`);
    assert.ok(def.name, `Theme ${id} must have name`);
    assert.ok(def.colors.canvas, `Theme ${id} must have canvas color`);
    assert.ok(def.colors.card, `Theme ${id} must have card color`);
    assert.ok(def.colors.text, `Theme ${id} must have text color`);
    assert.ok(def.colors.muted, `Theme ${id} must have muted color`);

    // WCAG AAA requires >= 7.0:1 for normal text
    assert.ok(
      def.contrastRatio.bodyOnCard >= 7.0,
      `Theme ${id} body text contrast (${def.contrastRatio.bodyOnCard}:1) must be >= 7.0:1`
    );
    assert.ok(
      def.contrastRatio.mutedOnCard >= 7.0,
      `Theme ${id} muted text contrast (${def.contrastRatio.mutedOnCard}:1) must be >= 7.0:1`
    );
  }
});

test('STATUS_STYLES covers all standard execution statuses with icons and colors', () => {
  const expectedStatuses = ['passed', 'failed', 'blocked', 'skipped', 'pending', 'flaky', 'automated'];

  for (const status of expectedStatuses) {
    const style = STATUS_STYLES[status];
    assert.ok(style, `Style for status "${status}" must exist`);
    assert.ok(style.label, `Status "${status}" must have a label`);
    assert.ok(style.colorHex, `Status "${status}" must have a colorHex`);
    assert.ok(style.iconName, `Status "${status}" must have an iconName`);
    assert.ok(style.bg, `Status "${status}" must have bg styling`);
  }
});
