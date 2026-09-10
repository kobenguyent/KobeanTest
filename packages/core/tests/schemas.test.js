import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTestCase,
  validateTestStep,
  validateTestSuite,
  validateRepoConnection,
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

test('validateIngestBatchPayload validates suite_path, tags, and attachments', () => {
  const validPayload = {
    idempotency_key: 'test-run-123',
    run_name: 'Playwright E2E Suite',
    results: [
      {
        automation_id: 'tests/checkout.spec.ts#pay',
        title: 'Checkout flow @LOC-3',
        suite_path: ['E2E', 'Payments', 'Checkout'],
        tags: ['@LOC-3', 'smoke'],
        status: 'passed',
        duration_ms: 320,
        attachments: [
          {
            file_name: 'failure.png',
            mime_type: 'image/png',
            data_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        ],
      },
    ],
  };

  const res = validateIngestBatchPayload(validPayload);
  assert.equal(res.success, true);
  assert.deepEqual(res.data.results[0].suite_path, ['E2E', 'Payments', 'Checkout']);
  assert.equal(res.data.results[0].attachments.length, 1);
});

test('validateIngestBatchPayload rejects invalid attachments', () => {
  const invalidPayload = {
    idempotency_key: 'test-run-456',
    run_name: 'Playwright Bad Attachments',
    results: [
      {
        automation_id: 'test-bad-att',
        title: 'Bad Attachment Test',
        status: 'failed',
        attachments: [
          { file_name: '', mime_type: 'image/png', data_base64: '' },
        ],
      },
    ],
  };

  const res = validateIngestBatchPayload(invalidPayload);
  assert.equal(res.success, false);
  assert.ok(res.errors.some((e) => e.includes('file_name cannot be empty')));
  assert.ok(res.errors.some((e) => e.includes('data_base64 cannot be empty')));
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

test('validateRepoConnection succeeds on valid GitHub connection', () => {
  const validConn = {
    id: 'conn-1',
    project_id: 'proj-1',
    name: 'Main Web Repo',
    provider: 'github',
    repo_name: 'acme-corp/kobean-web',
    repo_url: 'https://github.com/acme-corp/kobean-web',
    default_branch: 'main',
  };
  const res = validateRepoConnection(validConn);
  assert.equal(res.success, true);
  assert.equal(res.data.repo_name, 'acme-corp/kobean-web');
  assert.equal(res.data.default_branch, 'main');
});

test('validateRepoConnection rejects invalid inputs', () => {
  const invalid = {
    id: '',
    project_id: '',
    name: '',
    repo_name: '',
    repo_url: '',
  };
  const res = validateRepoConnection(invalid);
  assert.equal(res.success, false);
  assert.ok(res.errors.length >= 5);
});

test('validateTestSuite preserves repo_connection_id, github_repo, and file_path', () => {
  const suiteWithRepo = {
    id: 'suite-auth',
    project_id: 'proj-1',
    title: 'Authentication Suite',
    repo_connection_id: 'conn-1',
    github_repo: 'acme-corp/kobean-web',
    file_path: 'tests/e2e/auth.spec.ts',
  };
  const res = validateTestSuite(suiteWithRepo);
  assert.equal(res.success, true);
  assert.equal(res.data.repo_connection_id, 'conn-1');
  assert.equal(res.data.github_repo, 'acme-corp/kobean-web');
  assert.equal(res.data.file_path, 'tests/e2e/auth.spec.ts');
});

test('validateIngestBatchPayload accepts github_repo, repo_connection_id, and PR info', () => {
  const payloadWithRepo = {
    idempotency_key: 'ci-run-999',
    run_name: 'CI GitHub Actions Run #42',
    commit_sha: '7f3b89a1234567890abcdef',
    branch: 'feature/totp',
    repo_connection_id: 'conn-1',
    github_repo: 'acme-corp/kobean-web',
    pull_request_number: 142,
    pull_request_url: 'https://github.com/acme-corp/kobean-web/pull/142',
    results: [
      { automation_id: 'test-1', title: 'Test 1', status: 'passed' },
    ],
  };
  const res = validateIngestBatchPayload(payloadWithRepo);
  assert.equal(res.success, true);
  assert.equal(res.data.github_repo, 'acme-corp/kobean-web');
  assert.equal(res.data.repo_connection_id, 'conn-1');
  assert.equal(res.data.pull_request_number, 142);
  assert.equal(res.data.pull_request_url, 'https://github.com/acme-corp/kobean-web/pull/142');
});

