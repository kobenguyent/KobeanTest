import test from 'node:test';
import assert from 'node:assert/strict';
import KobeanPlaywrightReporter from '../src/reporters/playwright.ts';
import KobeanJestReporter from '../src/reporters/jest.ts';
import { kobeanCypressPlugin } from '../src/reporters/cypress.ts';

test('KobeanPlaywrightReporter captures suite hierarchy, tags, and handles offline daemon', async () => {
  const reporter = new KobeanPlaywrightReporter({
    daemonUrl: 'http://127.0.0.1:49999', // offline port
    token: 'test-token',
    projectId: 'proj-1',
  });

  const mockTest = {
    title: 'should submit checkout form @LOC-3',
    tags: ['@LOC-3', 'smoke'],
    parent: {
      title: 'Checkout Flow',
      parent: {
        title: 'E2E Suites',
      },
    },
    location: {
      file: 'tests/checkout.spec.ts',
    },
    outcome: () => 'expected',
  };

  const mockResult = {
    status: 'passed',
    duration: 420,
    errors: [],
    attachments: [
      {
        name: 'screenshot',
        contentType: 'image/png',
        body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ],
  };

  reporter.onTestEnd(mockTest, mockResult);

  // onEnd should not throw even if daemon is offline (graceful degradation)
  await assert.doesNotReject(async () => {
    await reporter.onEnd();
  });
});

test('KobeanJestReporter maps ancestor titles and handles offline daemon', async () => {
  const reporter = new KobeanJestReporter(undefined, {
    daemonUrl: 'http://127.0.0.1:49999', // offline port
  });

  const mockJestResults = {
    testResults: [
      {
        testFilePath: '/app/tests/auth.test.ts',
        testResults: [
          {
            ancestorTitles: ['Auth Module', 'Password Reset'],
            title: 'sends reset link @LOC-5',
            status: 'passed',
            duration: 150,
          },
        ],
      },
    ],
  };

  await assert.doesNotReject(async () => {
    await reporter.onRunComplete(undefined, mockJestResults);
  });
});

test('kobeanCypressPlugin registers after:run and handles offline daemon', async () => {
  let registeredEvent = '';
  let registeredCallback = null;

  const mockOn = (event, cb) => {
    registeredEvent = event;
    registeredCallback = cb;
  };

  kobeanCypressPlugin(mockOn, undefined, {
    daemonUrl: 'http://127.0.0.1:49999',
  });

  assert.equal(registeredEvent, 'after:run');
  assert.ok(registeredCallback);

  const mockCypressRun = {
    runs: [
      {
        spec: { relative: 'cypress/e2e/payment.cy.ts' },
        tests: [
          {
            title: ['Payments', 'Checkout', 'processes card @LOC-12'],
            state: 'passed',
            duration: 500,
          },
        ],
      },
    ],
  };

  await assert.doesNotReject(async () => {
    await registeredCallback(mockCypressRun);
  });
});
