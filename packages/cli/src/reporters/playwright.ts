import fs from 'node:fs';
import path from 'node:path';
import type { IngestResultItem, IngestAttachmentInput, KobeanReporterOptions } from '@kobean/core';
import { getSessionConfig, submitBatch } from '../index.ts';

export interface PlaywrightTestAttachment {
  name: string;
  contentType: string;
  path?: string;
  body?: Buffer | string;
}

export interface PlaywrightTestError {
  message?: string;
  stack?: string;
}

export interface PlaywrightTestResult {
  status?: string;
  duration?: number;
  errors?: PlaywrightTestError[];
  attachments?: PlaywrightTestAttachment[];
}

export interface PlaywrightTestCase {
  title: string;
  tags?: string[];
  parent?: {
    title?: string;
    parent?: unknown;
  };
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  outcome?: () => string;
}

export interface PlaywrightFullResult {
  status?: string;
}

/**
 * First-class Playwright reporter for KobeanTest.
 * Transmits test execution outcomes, suite hierarchy, and failure screenshot attachments
 * to the localhost daemon with non-blocking offline tolerance.
 */
export default class KobeanPlaywrightReporter {
  private options: KobeanReporterOptions;
  private results: IngestResultItem[] = [];

  constructor(options: KobeanReporterOptions = {}) {
    this.options = options;
  }

  onTestEnd(test: PlaywrightTestCase, result: PlaywrightTestResult): void {
    // 1. Build suite path from parent hierarchy
    const suite_path: string[] = [];
    let curr: any = test.parent;
    while (curr) {
      if (curr.title && curr.title.trim().length > 0) {
        suite_path.unshift(curr.title.trim());
      }
      curr = curr.parent;
    }

    const title = test.title.trim();
    const file = test.location?.file || '';
    const automation_id = file ? `${file}#${title}` : title;

    // 2. Extract tags
    const tags: string[] = Array.isArray(test.tags) ? [...test.tags] : [];
    const inlineMatches = title.match(/@[\w-]+/g);
    if (inlineMatches) {
      for (const m of inlineMatches) {
        if (!tags.includes(m)) tags.push(m);
      }
    }

    // 3. Map status
    let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';
    const outcome = typeof test.outcome === 'function' ? test.outcome() : result.status;
    if (outcome === 'expected' || outcome === 'passed') {
      status = 'passed';
    } else if (outcome === 'skipped') {
      status = 'skipped';
    } else if (outcome === 'flaky') {
      status = 'passed';
      if (!tags.includes('flaky')) tags.push('flaky');
    } else {
      status = 'failed';
    }

    // 4. Format error & stack
    let error_message: string | undefined;
    let stack_trace: string | undefined;
    if (result.errors && result.errors.length > 0) {
      error_message = result.errors
        .map((e) => e.message || '')
        .filter(Boolean)
        .join('\n')
        .trim() || 'Playwright assertion failed';
      stack_trace = result.errors
        .map((e) => e.stack || e.message || '')
        .filter(Boolean)
        .join('\n\n')
        .trim() || error_message;
    }

    // 5. Attachments
    const attachments: IngestAttachmentInput[] = [];
    if (Array.isArray(result.attachments)) {
      for (const att of result.attachments) {
        const isImage =
          att.contentType?.startsWith('image/') ||
          att.name === 'screenshot' ||
          att.path?.endsWith('.png') ||
          att.path?.endsWith('.jpg') ||
          att.path?.endsWith('.jpeg') ||
          att.path?.endsWith('.webp');

        if (!isImage) continue;

        let data_base64 = '';
        if (att.body) {
          data_base64 = Buffer.isBuffer(att.body) ? att.body.toString('base64') : String(att.body);
        } else if (att.path && fs.existsSync(att.path)) {
          try {
            data_base64 = fs.readFileSync(att.path).toString('base64');
          } catch {
            // Non-blocking disk read fallback
          }
        }

        if (data_base64) {
          attachments.push({
            file_name: att.path ? path.basename(att.path) : (att.name || 'screenshot.png'),
            mime_type: att.contentType || 'image/png',
            data_base64,
          });
        }
      }
    }

    this.results.push({
      automation_id,
      title,
      suite_path: suite_path.length > 0 ? suite_path : undefined,
      tags: tags.length > 0 ? tags : undefined,
      status,
      duration_ms: Math.round(result.duration || 0),
      ...(error_message ? { error_message } : {}),
      ...(stack_trace ? { stack_trace } : {}),
      attempt_number: 1,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  async onEnd(_result?: PlaywrightFullResult): Promise<void> {
    if (this.results.length === 0) return;

    const session = getSessionConfig();
    const port = this.options.daemonUrl
      ? parseInt(new URL(this.options.daemonUrl).port || '4000', 10)
      : session?.port || 4000;
    const token = this.options.token || session?.token || '';
    const projectId = this.options.projectId || process.env['KOBEAN_PROJECT_ID'] || '';
    const runName = this.options.runName || `Playwright Run - ${new Date().toISOString()}`;
    const idempotencyKey = `playwright-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await submitBatch(
        port,
        token,
        projectId,
        runName,
        idempotencyKey,
        this.results,
        this.options.environment
      );
      process.stdout.write(`\n✓ [KobeanTest] Ingested ${this.results.length} Playwright test results.\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n[KobeanTest] ⚠ Ingestion skipped: ${msg}\n`);
    }
  }
}
