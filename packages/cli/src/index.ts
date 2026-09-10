import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import type { IngestResultItem, IngestBatchPayload } from '@kobean/core';
import { parseJunitXml, type ParsedJunitCase } from './junit.ts';
import { parsePlaywrightJson } from './parsers/playwright-json.ts';
import { parseCucumberJson } from './parsers/cucumber-json.ts';

export * from './junit.ts';
export * from './parsers/playwright-json.ts';
export * from './parsers/cucumber-json.ts';
export { default as KobeanPlaywrightReporter } from './reporters/playwright.ts';
export { default as KobeanJestReporter } from './reporters/jest.ts';
export { kobeanCypressPlugin } from './reporters/cypress.ts';

export interface SessionConfig {
  token: string;
  port: number;
  pid: number;
  created_at: number;
}

export function getSessionConfig(): SessionConfig | null {
  if (process.env['KOBEAN_TOKEN']) {
    return {
      token: process.env['KOBEAN_TOKEN'],
      port: parseInt(process.env['KOBEAN_PORT'] || '4000', 10),
      pid: process.pid,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  const kobeanHome = process.env['KOBEAN_HOME'] || path.join(os.homedir(), '.kobean');
  const sessionPath = path.join(kobeanHome, 'session.json');

  if (fs.existsSync(sessionPath)) {
    try {
      const data = fs.readFileSync(sessionPath, 'utf8');
      return JSON.parse(data) as SessionConfig;
    } catch {
      return null;
    }
  }

  return null;
}

export async function submitBatch(
  port: number,
  token: string,
  projectId: string,
  runName: string,
  idempotencyKey: string,
  results: IngestResultItem[],
  environment?: string,
  repoConnectionId?: string,
  githubRepo?: string
) {
  const url = projectId
    ? `http://127.0.0.1:${port}/api/v1/projects/${projectId}/ci/ingest`
    : `http://127.0.0.1:${port}/api/v1/ci/ingest`;

  const repo = githubRepo || process.env['GITHUB_REPOSITORY'] || undefined;
  const connectionId = repoConnectionId || process.env['KOBEAN_REPO_CONNECTION_ID'] || undefined;
  const prNumberStr = process.env['GITHUB_PR_NUMBER'] || (process.env['GITHUB_REF']?.match(/^refs\/pull\/(\d+)\/merge$/)?.[1]);
  const prNumber = prNumberStr ? parseInt(prNumberStr, 10) : undefined;
  const prUrl = process.env['GITHUB_PR_URL'] || (repo && prNumber ? `https://github.com/${repo}/pull/${prNumber}` : undefined);

  const payload: IngestBatchPayload = {
    idempotency_key: idempotencyKey,
    run_name: runName,
    commit_sha: process.env['GITHUB_SHA'] || process.env['GIT_COMMIT'] || undefined,
    branch: process.env['GITHUB_REF_NAME'] || process.env['GIT_BRANCH'] || undefined,
    repo_connection_id: connectionId,
    github_repo: repo,
    pull_request_number: prNumber,
    pull_request_url: prUrl,
    environment: environment || process.env['KOBEAN_ENV'] || 'ci',
    auto_create_cases: true,
    results,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(projectId ? { 'X-Project-Id': projectId } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ingestion failed (${response.status}): ${text}`);
  }

  return await response.json();
}

function printSummaryBanner(
  runName: string,
  total: number,
  passed: number,
  failed: number,
  skipped: number,
  port: number,
  runId: string
) {
  console.log('\n────────────────────────────────────────────────────────');
  console.log(` ✦ KobeanTest Execution Ingested: ${runName}`);
  console.log(`   Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}  |  Skipped: ${skipped}`);
  console.log(`   Local Dashboard: http://127.0.0.1:${port}/#run-${runId}`);
  console.log('────────────────────────────────────────────────────────\n');
}

export async function runCli(args: string[]): Promise<number> {
  const command = args[2] || 'help';

  if (command === 'status') {
    const session = getSessionConfig();
    const port = session?.port || 4000;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const data = (await res.json()) as { version?: string };
        console.log(`✓ KobeanTest Daemon is active on http://127.0.0.1:${port}`);
        console.log(`  Version: ${data.version || '0.1.0'}`);
        return 0;
      }
    } catch {
      console.error(`✗ KobeanTest Daemon is not reachable at http://127.0.0.1:${port}`);
      return 1;
    }
  }

  if (command === 'report' || command === 'ingest') {
    let projectId = process.env['KOBEAN_PROJECT_ID'] || '';
    let filePath = '';
    let format = 'junit';
    let runName = `CLI Ingest - ${new Date().toISOString()}`;
    let githubRepo = process.env['GITHUB_REPOSITORY'] || '';
    let repoConnectionId = process.env['KOBEAN_REPO_CONNECTION_ID'] || '';

    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--project' && args[i + 1]) {
        projectId = args[i + 1]!;
        i++;
      } else if (args[i] === '--file' && args[i + 1]) {
        filePath = args[i + 1]!;
        i++;
      } else if (args[i] === '--format' && args[i + 1]) {
        format = args[i + 1]!.toLowerCase();
        i++;
      } else if (args[i] === '--name' && args[i + 1]) {
        runName = args[i + 1]!;
        i++;
      } else if (args[i] === '--repo' && args[i + 1]) {
        githubRepo = args[i + 1]!;
        i++;
      } else if (args[i] === '--repo-connection' && args[i + 1]) {
        repoConnectionId = args[i + 1]!;
        i++;
      }
    }

    if (!filePath) {
      console.error('Usage: kobean report --file <path> [--format <junit|playwright-json|cucumber-json>] [--project <id>] [--name <run_name>]');
      return 1;
    }

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return 1;
    }

    const session = getSessionConfig();
    if (!session) {
      console.error('Session not found in ~/.kobean/session.json. Is KobeanTest running?');
      return 1;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let cases: IngestResultItem[] = [];

    if (format === 'playwright-json' || filePath.endsWith('.json')) {
      try {
        cases = parsePlaywrightJson(content, { cwd: path.dirname(filePath) });
      } catch {
        cases = parseCucumberJson(content);
      }
    } else if (format === 'cucumber-json') {
      cases = parseCucumberJson(content);
    } else {
      cases = parseJunitXml(content);
    }

    console.log(`Parsed ${cases.length} test cases from ${filePath} (${format})`);

    const idempotencyKey = `cli-${path.basename(filePath)}-${fs.statSync(filePath).mtimeMs}`;
    try {
      const resp = (await submitBatch(
        session.port,
        session.token,
        projectId,
        runName,
        idempotencyKey,
        cases,
        undefined,
        repoConnectionId || undefined,
        githubRepo || undefined
      )) as {
        run_id: string;
      };

      const passed = cases.filter((c) => c.status === 'passed').length;
      const failed = cases.filter((c) => c.status === 'failed').length;
      const skipped = cases.filter((c) => c.status === 'skipped').length;
      printSummaryBanner(runName, cases.length, passed, failed, skipped, session.port, resp.run_id);
      return 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ Ingestion failed: ${msg}`);
      return 1;
    }
  }

  if (command === 'run') {
    let framework = '';
    let execCommand = '';
    let customFormat = '';
    let customFile = '';
    let projectId = process.env['KOBEAN_PROJECT_ID'] || '';
    let runName = `Test Run - ${new Date().toISOString()}`;
    let githubRepo = process.env['GITHUB_REPOSITORY'] || '';
    let repoConnectionId = process.env['KOBEAN_REPO_CONNECTION_ID'] || '';

    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--playwright') {
        framework = 'playwright';
        execCommand = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'npx playwright test';
      } else if (args[i] === '--cypress') {
        framework = 'cypress';
        execCommand = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'npx cypress run';
      } else if (args[i] === '--jest') {
        framework = 'jest';
        execCommand = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'npm test';
      } else if (args[i] === '--vitest') {
        framework = 'vitest';
        execCommand = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'npx vitest run';
      } else if (args[i] === '--pytest') {
        framework = 'pytest';
        execCommand = args[i + 1] && !args[i + 1]!.startsWith('--') ? args[++i]! : 'pytest';
      } else if (args[i] === '--cmd' && args[i + 1]) {
        framework = 'custom';
        execCommand = args[++i]!;
      } else if (args[i] === '--format' && args[i + 1]) {
        customFormat = args[++i]!;
      } else if (args[i] === '--file' && args[i + 1]) {
        customFile = args[++i]!;
      } else if (args[i] === '--project' && args[i + 1]) {
        projectId = args[++i]!;
      } else if (args[i] === '--name' && args[i + 1]) {
        runName = args[++i]!;
      } else if (args[i] === '--repo' && args[i + 1]) {
        githubRepo = args[++i]!;
      } else if (args[i] === '--repo-connection' && args[i + 1]) {
        repoConnectionId = args[++i]!;
      }
    }

    if (!framework && !execCommand) {
      console.error(`
Usage:
  kobean run --playwright ["npx playwright test"]
  kobean run --cypress ["npx cypress run"]
  kobean run --jest ["npm test"]
  kobean run --vitest ["npx vitest run"]
  kobean run --pytest ["pytest"]
  kobean run --cmd "<command>" --format <junit|playwright-json|cucumber-json> --file <path>
      `);
      return 1;
    }

    const tmpDir = os.tmpdir();
    let reportFile = customFile;
    let format = customFormat || 'junit';
    const env = { ...process.env };

    if (framework === 'playwright') {
      reportFile = reportFile || path.join(tmpDir, `kobean-pw-${Date.now()}.json`);
      format = 'playwright-json';
      env['PLAYWRIGHT_JSON_OUTPUT_NAME'] = reportFile;
      if (!execCommand.includes('--reporter')) {
        execCommand += ' --reporter=list,json';
      }
    } else if (framework === 'pytest') {
      reportFile = reportFile || path.join(tmpDir, `kobean-pytest-${Date.now()}.xml`);
      format = 'junit';
      if (!execCommand.includes('--junitxml')) {
        execCommand += ` -o junit_family=xunit2 --junitxml=${reportFile}`;
      }
    } else if (framework === 'cypress') {
      reportFile = reportFile || path.join(tmpDir, `kobean-cypress-${Date.now()}.xml`);
      format = 'junit';
      if (!execCommand.includes('--reporter')) {
        execCommand += ` --reporter junit --reporter-options mochaFile=${reportFile}`;
      }
    } else if (framework === 'vitest') {
      reportFile = reportFile || path.join(tmpDir, `kobean-vitest-${Date.now()}.xml`);
      format = 'junit';
      if (!execCommand.includes('--outputFile')) {
        execCommand += ` --reporter=default --reporter=junit --outputFile.junit=${reportFile}`;
      }
    }

    console.log(`\n▶ Running test command: ${execCommand}\n`);

    const childExitCode = await new Promise<number>((resolve) => {
      const child = spawn(execCommand, {
        shell: true,
        stdio: 'inherit',
        env,
      });

      child.on('error', (err) => {
        console.error(`Failed to start child process: ${err.message}`);
        resolve(1);
      });

      child.on('exit', (code) => {
        resolve(code ?? 0);
      });
    });

    // Ingestion step
    if (reportFile && fs.existsSync(reportFile)) {
      try {
        const content = fs.readFileSync(reportFile, 'utf8');
        let cases: IngestResultItem[] = [];

        if (format === 'playwright-json') {
          cases = parsePlaywrightJson(content, { cwd: process.cwd() });
        } else if (format === 'cucumber-json') {
          cases = parseCucumberJson(content);
        } else {
          cases = parseJunitXml(content);
        }

        const session = getSessionConfig();
        if (session && cases.length > 0) {
          const idempotencyKey = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const resp = (await submitBatch(
            session.port,
            session.token,
            projectId,
            runName,
            idempotencyKey,
            cases,
            undefined,
            repoConnectionId || undefined,
            githubRepo || undefined
          )) as {
            run_id: string;
          };

          const passed = cases.filter((c) => c.status === 'passed').length;
          const failed = cases.filter((c) => c.status === 'failed').length;
          const skipped = cases.filter((c) => c.status === 'skipped').length;
          printSummaryBanner(runName, cases.length, passed, failed, skipped, session.port, resp.run_id);
        } else if (!session) {
          console.warn('\n[KobeanTest] ⚠ Local daemon offline at http://127.0.0.1:4000. Ingestion skipped.\n');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`\n[KobeanTest] ⚠ Ingestion error: ${msg}\n`);
      } finally {
        // Clean up temp report file if created by us
        if (reportFile.startsWith(tmpDir) && fs.existsSync(reportFile)) {
          try {
            fs.unlinkSync(reportFile);
          } catch {
            // Ignore
          }
        }
      }
    }

    return childExitCode;
  }

  console.log(`
KobeanTest CLI (@kobean/cli)

Usage:
  kobean status                                Check local daemon health
  kobean run --playwright ["cmd"]              Run Playwright tests & ingest results
  kobean run --cypress ["cmd"]                 Run Cypress tests & ingest results
  kobean run --jest ["cmd"]                    Run Jest tests & ingest results
  kobean run --vitest ["cmd"]                  Run Vitest tests & ingest results
  kobean run --pytest ["cmd"]                  Run Pytest tests & ingest results
  kobean report --file <path> [--format <fmt>] Ingest standalone test report file
  `);
  return 0;
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('kobean')) {
  runCli(process.argv).then((code) => {
    if (code !== 0) process.exit(code);
  });
}
