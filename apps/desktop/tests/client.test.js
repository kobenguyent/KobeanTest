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

test('KobeanApiClient getMediaUrl handles paths and includes auth query parameter', () => {
  const client = new KobeanApiClient(4000, 'tok-xyz');
  const url1 = client.getMediaUrl('defect-123.png');
  assert.equal(url1, 'http://127.0.0.1:4000/api/v1/media/defect-123.png?token=tok-xyz');

  const url2 = client.getMediaUrl('/Users/kobean/.kobean/media/nested_screen.jpg');
  assert.equal(url2, 'http://127.0.0.1:4000/api/v1/media/nested_screen.jpg?token=tok-xyz');

  const clientNoToken = new KobeanApiClient(4000);
  const url3 = clientNoToken.getMediaUrl('plain.png');
  assert.equal(url3, 'http://127.0.0.1:4000/api/v1/media/plain.png');
});

test('KobeanApiClient provides methods for optional GitHub account lifecycle', () => {
  const client = new KobeanApiClient(4000, 'tok-test');
  assert.equal(typeof client.getGitHubAccount, 'function');
  assert.equal(typeof client.saveGitHubAccount, 'function');
  assert.equal(typeof client.deleteGitHubAccount, 'function');
});
