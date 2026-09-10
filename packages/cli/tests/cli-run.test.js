import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../src/index.ts';

test('kobean help returns 0', async () => {
  const code = await runCli(['node', 'kobean', 'help']);
  assert.equal(code, 0);
});

test('kobean status checks daemon connectivity', async () => {
  const code = await runCli(['node', 'kobean', 'status']);
  // If daemon is active, returns 0. If not, returns 1. In both cases it executes cleanly.
  assert.ok(code === 0 || code === 1);
});

test('kobean report without file returns error code 1', async () => {
  const code = await runCli(['node', 'kobean', 'report']);
  assert.equal(code, 1);
});

test('kobean run forwards child process exit code', async () => {
  // Exits with 42
  const code42 = await runCli(['node', 'kobean', 'run', '--cmd', 'node -e "process.exit(42)"']);
  assert.equal(code42, 42);

  // Exits with 0
  const code0 = await runCli(['node', 'kobean', 'run', '--cmd', 'node -e "process.exit(0)"']);
  assert.equal(code0, 0);
});
