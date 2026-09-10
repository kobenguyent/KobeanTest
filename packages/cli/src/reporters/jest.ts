import type { IngestResultItem, KobeanReporterOptions } from '@kobean/core';
import { getSessionConfig, submitBatch } from '../index.ts';

export interface JestAssertionResult {
  ancestorTitles: string[];
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled';
  duration?: number | null;
  failureMessages?: string[];
  failureDetails?: unknown[];
}

export interface JestTestFileResult {
  testFilePath: string;
  testResults: JestAssertionResult[];
}

export interface JestAggregatedResult {
  testResults: JestTestFileResult[];
}

/**
 * First-class Jest & Vitest reporter for KobeanTest.
 * Add to `jest.config.js` or `vitest.config.ts`:
 * `reporters: ['default', ['@kobean/cli/jest', { projectId: '...' }]]`.
 */
export default class KobeanJestReporter {
  private options: KobeanReporterOptions;

  constructor(globalConfig?: unknown, options: KobeanReporterOptions = {}) {
    // Jest passes (globalConfig, reporterOptions)
    this.options = options;
  }

  async onRunComplete(_testContexts: unknown, results: JestAggregatedResult): Promise<void> {
    if (!results || !Array.isArray(results.testResults)) return;

    const items: IngestResultItem[] = [];

    for (const fileResult of results.testResults) {
      const file = fileResult.testFilePath || '';

      if (!Array.isArray(fileResult.testResults)) continue;

      for (const assertion of fileResult.testResults) {
        const title = assertion.title.trim();
        const suite_path = assertion.ancestorTitles?.map((t) => t.trim()).filter(Boolean);
        const automation_id = file ? `${file}#${title}` : title;

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
        if (assertion.status === 'passed') {
          status = 'passed';
        } else if (assertion.status === 'skipped' || assertion.status === 'pending' || assertion.status === 'todo') {
          status = 'skipped';
        } else {
          status = 'failed';
        }

        let error_message: string | undefined;
        let stack_trace: string | undefined;
        if (assertion.failureMessages && assertion.failureMessages.length > 0) {
          const fullErr = assertion.failureMessages.join('\n\n');
          error_message = fullErr.split('\n')[0]?.trim() || 'Assertion error';
          stack_trace = fullErr.trim();
        }

        items.push({
          automation_id,
          title,
          suite_path: suite_path && suite_path.length > 0 ? suite_path : undefined,
          tags: tags.length > 0 ? tags : undefined,
          status,
          duration_ms: Math.round(assertion.duration || 0),
          ...(error_message ? { error_message } : {}),
          ...(stack_trace ? { stack_trace } : {}),
          attempt_number: 1,
        });
      }
    }

    if (items.length === 0) return;

    const session = getSessionConfig();
    const port = this.options.daemonUrl
      ? parseInt(new URL(this.options.daemonUrl).port || '4000', 10)
      : session?.port || 4000;
    const token = this.options.token || session?.token || '';
    const projectId = this.options.projectId || process.env['KOBEAN_PROJECT_ID'] || '';
    const runName = this.options.runName || `Jest Run - ${new Date().toISOString()}`;
    const idempotencyKey = `jest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await submitBatch(port, token, projectId, runName, idempotencyKey, items, this.options.environment);
      process.stdout.write(`\n✓ [KobeanTest] Ingested ${items.length} Jest/Vitest test results.\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n[KobeanTest] ⚠ Ingestion skipped: ${msg}\n`);
    }
  }
}
