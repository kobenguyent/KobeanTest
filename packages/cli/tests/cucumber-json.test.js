import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCucumberJson } from '../src/parsers/cucumber-json.ts';

test('parseCucumberJson parses features, scenarios, steps, and embeddings', () => {
  const sampleCucumber = [
    {
      uri: 'features/checkout.feature',
      name: 'Checkout Workflow',
      elements: [
        {
          name: 'Successful credit card purchase @LOC-10',
          type: 'scenario',
          tags: [{ name: '@LOC-10' }, { name: '@regression' }],
          steps: [
            {
              keyword: 'Given ',
              name: 'cart is ready',
              result: { status: 'passed', duration: 100000000 },
            },
            {
              keyword: 'When ',
              name: 'payment is submitted',
              result: { status: 'passed', duration: 250000000 },
            },
          ],
        },
        {
          name: 'Card expiration failure @LOC-11',
          type: 'scenario',
          tags: [{ name: '@LOC-11' }],
          steps: [
            {
              keyword: 'Given ',
              name: 'user enters expired card',
              result: { status: 'passed', duration: 50000000 },
            },
            {
              keyword: 'Then ',
              name: 'error alert appears',
              result: {
                status: 'failed',
                duration: 150000000,
                error_message: 'AssertionError: Expected error banner visible\n    at checkout.steps.ts:42',
              },
              embeddings: [
                {
                  mime_type: 'image/png',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const results = parseCucumberJson(sampleCucumber);
  assert.equal(results.length, 2);

  // Scenario 1: Passed
  assert.equal(results[0]?.title, 'Successful credit card purchase @LOC-10');
  assert.equal(results[0]?.status, 'passed');
  assert.equal(results[0]?.duration_ms, 350);
  assert.deepEqual(results[0]?.suite_path, ['Checkout Workflow']);
  assert.deepEqual(results[0]?.tags, ['@LOC-10', '@regression']);

  // Scenario 2: Failed with screenshot embedding
  assert.equal(results[1]?.title, 'Card expiration failure @LOC-11');
  assert.equal(results[1]?.status, 'failed');
  assert.equal(results[1]?.duration_ms, 200);
  assert.ok(results[1]?.error_message?.includes('Expected error banner'));
  assert.equal(results[1]?.attachments?.length, 1);
  assert.equal(results[1]?.attachments?.[0]?.file_name, 'step-2-screenshot.png');
  assert.equal(results[1]?.attachments?.[0]?.mime_type, 'image/png');
  assert.equal(results[1]?.attachments?.[0]?.step_number, 2);
});

test('parseCucumberJson handles empty inputs gracefully', () => {
  assert.deepEqual(parseCucumberJson(''), []);
  assert.deepEqual(parseCucumberJson('[]'), []);
  assert.deepEqual(parseCucumberJson({}), []);
});
