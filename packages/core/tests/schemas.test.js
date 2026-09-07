import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTestCase,
  validateTestStep,
  validateTestSuite,
  validateIngestBatchPayload,
  EXECUTION_STATUS_MAP,
  PRIORITY_MAP,
} from '../src/index.ts';

test('validateTestStep succeeds on valid step', () => {
  const step = {
    step_number: 1,
    action: 'Click submit button',
    expected: 'Form submits and redirect occurs',
  };
  const res = validateTestStep(step);
  assert.equal(res.success, true);
  assert.equal(res.data.step_number, 1);
});

test('validateTestStep rejects empty action or expected', () => {
  const invalidStep = {
    step_number: 1,
    action: '',
    expected: '   ',
  };
  const res = validateTestStep(invalidStep);
  assert.equal(res.success, false);
  assert.equal(res.errors.length, 2);
});

test('validateTestSuite rejects self-referencing parent_id cycle', () => {
  const cyclicSuite = {
    id: 'suite-123',
    project_id: 'proj-1',
    title: 'Cycle Suite',
    parent_id: 'suite-123',
  };
  const res = validateTestSuite(cyclicSuite);
  assert.equal(res.success, false);
  assert.match(res.errors[0], /cycle detected/i);
});

test('validateTestCase validates valid test case', () => {
  const validCase = {
    id: 'case-1',
    project_id: 'proj-1',
    suite_id: 'suite-1',
    case_number: 101,
    title: 'Valid authentication flow',
    preconditions: 'User is registered',
    steps: [
      { step_number: 1, action: 'Open login page', expected: 'Form visible' },
      { step_number: 2, action: 'Enter credentials', expected: 'Dashboard loaded' },
    ],
    priority: 'high',
    type: 'automated',
    automation_id: 'tests/auth.spec.ts#login',
    tags: ['auth', 'smoke'],
    is_flaky: false,
    is_archived: false,
    version: 1,
  };
  const res = validateTestCase(validCase);
  assert.equal(res.success, true);
  assert.equal(res.data.case_number, 101);
  assert.equal(res.data.steps.length, 2);
});

test('validateIngestBatchPayload requires idempotency_key', () => {
  const payloadWithoutKey = {
    run_name: 'Playwright Run #1',
    results: [
      { automation_id: 'test-1', title: 'Test 1', status: 'passed' },
    ],
  };
  const res = validateIngestBatchPayload(payloadWithoutKey);
  assert.equal(res.success, false);
  assert.match(res.errors[0], /idempotency_key/i);
});

test('status map covers all execution statuses with icon and color', () => {
  const statuses = ['passed', 'failed', 'blocked', 'skipped'];
  for (const st of statuses) {
    const desc = EXECUTION_STATUS_MAP[st];
    assert.ok(desc, `Missing descriptor for ${st}`);
    assert.ok(desc.icon);
    assert.ok(desc.colorHex);
    assert.ok(desc.badgeClass);
  }
});
