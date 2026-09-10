import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJunitXml } from '../src/junit.ts';

test('parseJunitXml parses standard test suite with passed, failed, and skipped cases', () => {
  const sampleXml = `
  <testsuites name="Jest Tests" tests="3" failures="1" time="1.5">
    <testsuite name="AuthSuite" tests="3" failures="1" skipped="1" time="1.5">
      <testcase classname="auth.spec.ts" name="valid login creates JWT" time="0.320">
      </testcase>
      <testcase classname="auth.spec.ts" name="invalid password returns 401" time="0.150">
        <failure message="Expected 401, received 500">
Error: Expected 401, received 500
    at /tests/auth.spec.ts:42:15
        </failure>
      </testcase>
      <testcase classname="auth.spec.ts" name="biometric login skipped on desktop" time="0.0">
        <skipped/>
      </testcase>
    </testsuite>
  </testsuites>
  `;

  const results = parseJunitXml(sampleXml);
  assert.equal(results.length, 3);

  // Case 1: Passed
  assert.equal(results[0]?.title, 'valid login creates JWT');
  assert.equal(results[0]?.automation_id, 'auth.spec.ts#valid login creates JWT');
  assert.equal(results[0]?.status, 'passed');
  assert.equal(results[0]?.duration_ms, 320);
  assert.deepEqual(results[0]?.suite_path, ['AuthSuite']);

  // Case 2: Failed
  assert.equal(results[1]?.title, 'invalid password returns 401');
  assert.equal(results[1]?.status, 'failed');
  assert.equal(results[1]?.duration_ms, 150);
  assert.ok(results[1]?.error_message?.includes('Expected 401'));
  assert.ok(results[1]?.stack_trace?.includes('/tests/auth.spec.ts:42'));

  // Case 3: Skipped
  assert.equal(results[2]?.title, 'biometric login skipped on desktop');
  assert.equal(results[2]?.status, 'skipped');
  assert.equal(results[2]?.duration_ms, 0);
});

test('parseJunitXml handles empty or minimal inputs without throwing', () => {
  assert.deepEqual(parseJunitXml(''), []);
  assert.deepEqual(parseJunitXml('<empty/>'), []);
});
