import fs from 'node:fs';
import path from 'node:path';
import type { IngestResultItem, IngestAttachmentInput, KobeanReporterOptions } from '@kobean/core';
import { getSessionConfig, submitBatch } from '../index.ts';

export interface CypressTestAttempt {
  state?: string;
  error?: { message?: string; stack?: string };
  screenshots?: Array<{ path: string; name?: string }>;
}

export interface CypressTest {
  title: string[]; // e.g. ["Cart Module", "Payment Flow", "Customer submits payment @LOC-4"]
  state: string;   // 'passed' | 'failed' | 'pending' | 'skipped'
  duration: number;
  displayError?: string;
  attempts?: CypressTestAttempt[];
}

export interface CypressRun {
  spec?: { name?: string; relative?: string };
  tests?: CypressTest[];
}

export interface CypressAfterRunResults {
  totalTests?: number;
  runs?: CypressRun[];
}

/**
 * Cypress plugin for KobeanTest integration.
 * Register in `cypress.config.ts` via `kobeanCypressPlugin(on, config, options)`.
 */
export function kobeanCypressPlugin(
  on: (event: string, callback: (...args: any[]) => any) => void,
  _config?: unknown,
  options: KobeanReporterOptions = {}
): void {
  on('after:run', async (results: CypressAfterRunResults) => {
    if (!results || !Array.isArray(results.runs) || results.runs.length === 0) {
      return;
    }

    const items: IngestResultItem[] = [];

    for (const run of results.runs) {
      const specFile = run.spec?.relative || run.spec?.name || '';

      if (!Array.isArray(run.tests)) continue;

      for (const test of run.tests) {
        const titleParts = Array.isArray(test.title) ? test.title : [String(test.title || 'Untitled Test')];
        const title = titleParts[titleParts.length - 1] || 'Untitled Test';
        const suite_path = titleParts.slice(0, -1);
        const automation_id = specFile ? `${specFile}#${titleParts.join(' > ')}` : titleParts.join(' > ');

        // Extract tags
        const tags: string[] = [];
        const inlineMatches = title.match(/@[\w-]+/g);
        if (inlineMatches) {
          for (const m of inlineMatches) {
            if (!tags.includes(m)) tags.push(m);
          }
        }

        // Map status
        let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';
        if (test.state === 'passed') {
          status = 'passed';
        } else if (test.state === 'pending' || test.state === 'skipped') {
          status = 'skipped';
        } else {
          status = 'failed';
        }

        // Error message & stack trace
        const lastAttempt = test.attempts && test.attempts.length > 0 ? test.attempts[test.attempts.length - 1] : undefined;
        let error_message = lastAttempt?.error?.message || test.displayError;
        let stack_trace = lastAttempt?.error?.stack || error_message;

        // Screenshots from attempts
        const attachments: IngestAttachmentInput[] = [];
        if (lastAttempt?.screenshots && Array.isArray(lastAttempt.screenshots)) {
          for (const s of lastAttempt.screenshots) {
            if (s.path && fs.existsSync(s.path)) {
              try {
                const b64 = fs.readFileSync(s.path).toString('base64');
                attachments.push({
                  file_name: path.basename(s.path),
                  mime_type: 'image/png',
                  data_base64: b64,
                });
              } catch {
                // Non-blocking disk read
              }
            }
          }
        }

        items.push({
          automation_id,
          title,
          suite_path: suite_path.length > 0 ? suite_path : undefined,
          tags: tags.length > 0 ? tags : undefined,
          status,
          duration_ms: Math.round(test.duration || 0),
          ...(error_message ? { error_message } : {}),
          ...(stack_trace ? { stack_trace } : {}),
          attempt_number: test.attempts ? test.attempts.length : 1,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      }
    }

    if (items.length === 0) return;

    const session = getSessionConfig();
    const port = options.daemonUrl
      ? parseInt(new URL(options.daemonUrl).port || '4000', 10)
      : session?.port || 4000;
    const token = options.token || session?.token || '';
    const projectId = options.projectId || process.env['KOBEAN_PROJECT_ID'] || '';
    const runName = options.runName || `Cypress Run - ${new Date().toISOString()}`;
    const idempotencyKey = `cypress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await submitBatch(port, token, projectId, runName, idempotencyKey, items, options.environment);
      process.stdout.write(`\n✓ [KobeanTest] Ingested ${items.length} Cypress test results.\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n[KobeanTest] ⚠ Ingestion skipped: ${msg}\n`);
    }
  });
}
