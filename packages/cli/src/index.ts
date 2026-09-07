import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseJunitXml } from './junit.ts';

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
  results: ReturnType<typeof parseJunitXml>
) {
  const url = `http://127.0.0.1:${port}/api/v1/projects/${projectId}/ci/ingest`;

  const payload = {
    idempotency_key: idempotencyKey,
    run_name: runName,
    commit_sha: process.env['GITHUB_SHA'] || process.env['GIT_COMMIT'] || undefined,
    branch: process.env['GITHUB_REF_NAME'] || process.env['GIT_BRANCH'] || undefined,
    auto_create_cases: true,
    results,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ingestion failed (${response.status}): ${text}`);
  }

  return await response.json();
}

export async function runCli(args: string[]): Promise<number> {
  const command = args[2] || 'help';

  if (command === 'status') {
    const session = getSessionConfig();
    const port = session?.port || 4000;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const data = await res.json();
        console.log(`✓ KobeanTest Daemon is active on http://127.0.0.1:${port}`);
        console.log(`  Version: ${data.version || '0.1.0'}`);
        return 0;
      }
    } catch {
      console.error(`✗ KobeanTest Daemon is not reachable at http://127.0.0.1:${port}`);
      return 1;
    }
  }

  if (command === 'ingest') {
    let projectId = '';
    let filePath = '';
    let runName = `CLI Ingest - ${new Date().toISOString()}`;

    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--project' && args[i + 1]) {
        projectId = args[i + 1]!;
        i++;
      } else if (args[i] === '--file' && args[i + 1]) {
        filePath = args[i + 1]!;
        i++;
      } else if (args[i] === '--name' && args[i + 1]) {
        runName = args[i + 1]!;
        i++;
      }
    }

    if (!projectId || !filePath) {
      console.error('Usage: kobean ingest --project <project_id> --file <junit.xml> [--name <run_name>]');
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
    const cases = parseJunitXml(content);
    console.log(`Parsed ${cases.length} test cases from ${filePath}`);

    const idempotencyKey = `cli-${path.basename(filePath)}-${fs.statSync(filePath).mtimeMs}`;
    const resp = await submitBatch(session.port, session.token, projectId, runName, idempotencyKey, cases);

    console.log('✓ Ingested successfully:');
    console.log(JSON.stringify(resp, null, 2));
    return 0;
  }

  console.log(`
KobeanTest CLI (@kobean/cli)

Usage:
  kobean status                                Check local daemon health
  kobean ingest --project <id> --file <path>   Ingest JUnit XML report
  `);
  return 0;
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('kobean')) {
  runCli(process.argv).then((code) => {
    if (code !== 0) process.exit(code);
  });
}
