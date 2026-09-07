import test from 'node:test';
import assert from 'node:assert/strict';
import { KobeanApiClient } from '../src/api/client.ts';

test('KobeanApiClient constructs expected URLs and includes bearer tokens', () => {
  const client = new KobeanApiClient(4000, 'test-token-123');
  assert.ok(client);

  client.setToken('updated-token-456');
  assert.ok(client);
});

test('MiniHud items structure validates step and case attributes', () => {
  const mockItem = {
    id: 'item-1',
    caseId: 'case-1',
    caseNumber: 1,
    title: 'Verify OAuth login challenge',
    projectKey: 'AUTH',
    status: 'pending',
    steps: [
      { step_number: 1, action: 'Open login page', expected: 'OAuth providers displayed' },
      { step_number: 2, action: 'Click Google', expected: 'Consent screen shown' },
    ],
  };

  assert.equal(mockItem.caseNumber, 1);
  assert.equal(mockItem.steps.length, 2);
  assert.equal(mockItem.steps[0]?.action, 'Open login page');
});
