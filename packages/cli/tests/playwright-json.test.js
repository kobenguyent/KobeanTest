import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaywrightJson } from '../src/parsers/playwright-json.ts';

test('parsePlaywrightJson parses recursive suite paths, tests, and errors', () => {
  const sampleReport = {
    config: {},
    suites: [
      {
        title: 'checkout.spec.ts',
        file: 'tests/checkout.spec.ts',
        suites: [
          {
            title: 'E2E Flow',
            suites: [
              {
                title: 'Stripe Gateway',
                specs: [
                  {
                    title: 'Customer completes purchase with Visa @LOC-3',
                    tags: ['@LOC-3', 'smoke'],
                    file: 'tests/checkout.spec.ts',
                    tests: [
                      {
                        projectName: 'chromium',
                        status: 'expected',
                        results: [
                          {
                            status: 'passed',
                            duration: 350,
                            errors: [],
                            attachments: [],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    title: 'Card declined banner shown on expired card @LOC-7',
                    tags: ['@LOC-7'],
                    file: 'tests/checkout.spec.ts',
                    tests: [
                      {
                        projectName: 'chromium',
                        status: 'unexpected',
                        results: [
                          {
                            status: 'failed',
                            duration: 1200,
                            errors: [
                              {
                                message: 'AssertionError: Expected "Card Declined" but got "Server Error"',
                                stack: 'Error: at checkout.spec.ts:88:14',
                              },
                            ],
                            attachments: [
                              {
                                name: 'screenshot',
                                contentType: 'image/png',
                                body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const results = parsePlaywrightJson(sampleReport);
  assert.equal(results.length, 2);

  // Case 1: Passed
  assert.equal(results[0]?.title, 'Customer completes purchase with Visa @LOC-3');
  assert.equal(results[0]?.status, 'passed');
  assert.equal(results[0]?.duration_ms, 350);
  assert.deepEqual(results[0]?.suite_path, ['checkout.spec.ts', 'E2E Flow', 'Stripe Gateway']);
  assert.deepEqual(results[0]?.tags, ['@LOC-3', 'smoke']);

  // Case 2: Failed with screenshot attachment
  assert.equal(results[1]?.title, 'Card declined banner shown on expired card @LOC-7');
  assert.equal(results[1]?.status, 'failed');
  assert.equal(results[1]?.duration_ms, 1200);
  assert.ok(results[1]?.error_message?.includes('Card Declined'));
  assert.ok(results[1]?.stack_trace?.includes('checkout.spec.ts:88:14'));
  assert.equal(results[1]?.attachments?.length, 1);
  assert.equal(results[1]?.attachments?.[0]?.mime_type, 'image/png');
  assert.ok(results[1]?.attachments?.[0]?.data_base64.length > 0);
});

test('parsePlaywrightJson handles empty or malformed strings gracefully', () => {
  assert.deepEqual(parsePlaywrightJson(''), []);
  assert.deepEqual(parsePlaywrightJson('   '), []);
  assert.deepEqual(parsePlaywrightJson('{ invalid json'), []);
  assert.deepEqual(parsePlaywrightJson({}), []);
});
