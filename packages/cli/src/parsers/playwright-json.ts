import fs from 'node:fs';
import path from 'node:path';
import type { IngestResultItem, IngestAttachmentInput } from '@kobean/core';

export interface PlaywrightJsonOptions {
  cwd?: string;
  maxAttachmentSizeBytes?: number;
}

interface RawPlaywrightSuite {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  specs?: RawPlaywrightSpec[];
  suites?: RawPlaywrightSuite[];
}

interface RawPlaywrightSpec {
  title?: string;
  ok?: boolean;
  tags?: string[];
  file?: string;
  line?: number;
  column?: number;
  id?: string;
  tests?: RawPlaywrightTest[];
}

interface RawPlaywrightTest {
  timeout?: number;
  expectedStatus?: string;
  projectName?: string;
  status?: string;
  results?: RawPlaywrightResult[];
}

interface RawPlaywrightResult {
  workerIndex?: number;
  status?: string;
  duration?: number;
  errors?: Array<{ message?: string; stack?: string; location?: unknown }>;
  attachments?: Array<{
    name?: string;
    contentType?: string;
    path?: string;
    body?: string;
  }>;
}

interface RawPlaywrightReport {
  config?: unknown;
  suites?: RawPlaywrightSuite[];
  errors?: unknown[];
  stats?: { startTime?: string; duration?: number };
}

/**
 * Zero-dependency Playwright JSON report parser adhering to Ponytail minimalism.
 * Recursively parses suites into hierarchical suite_paths, translates statuses,
 * formats failure stack traces, and encodes failure screenshot files to base64.
 */
export function parsePlaywrightJson(
  input: string | object,
  options: PlaywrightJsonOptions = {}
): IngestResultItem[] {
  let report: RawPlaywrightReport;
  if (typeof input === 'string') {
    if (!input.trim()) return [];
    try {
      report = JSON.parse(input) as RawPlaywrightReport;
    } catch {
      return [];
    }
  } else if (typeof input === 'object' && input !== null) {
    report = input as RawPlaywrightReport;
  } else {
    return [];
  }

  const results: IngestResultItem[] = [];
  const maxBytes = options.maxAttachmentSizeBytes || 10 * 1024 * 1024; // 10MB limit

  function traverseSuite(suite: RawPlaywrightSuite, currentPath: string[]) {
    const nextPath = [...currentPath];
    if (suite.title && suite.title.trim().length > 0) {
      nextPath.push(suite.title.trim());
    }

    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        const specTitle = spec.title?.trim() || 'Untitled Spec';
        const file = spec.file || suite.file || '';
        const specTags = Array.isArray(spec.tags) ? [...spec.tags] : [];

        // Extract inline tags like @LOC-3 if present in title
        const tagMatches = specTitle.match(/@[\w-]+/g);
        if (tagMatches) {
          for (const m of tagMatches) {
            if (!specTags.includes(m)) {
              specTags.push(m);
            }
          }
        }

        if (Array.isArray(spec.tests) && spec.tests.length > 0) {
          for (const test of spec.tests) {
            const projectSuffix = test.projectName ? ` [${test.projectName}]` : '';
            const automation_id = file
              ? `${file}#${specTitle}${projectSuffix}`
              : `${specTitle}${projectSuffix}`;

            // Map execution status
            const rawStatus = test.status || (test.results && test.results[test.results.length - 1]?.status);
            let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';
            if (rawStatus === 'expected') {
              status = 'passed';
            } else if (rawStatus === 'unexpected') {
              status = 'failed';
            } else if (rawStatus === 'flaky') {
              status = 'passed';
              if (!specTags.includes('flaky')) specTags.push('flaky');
            } else if (rawStatus === 'skipped') {
              status = 'skipped';
            } else if (rawStatus === 'failed' || rawStatus === 'timedOut' || rawStatus === 'interrupted') {
              status = 'failed';
            } else if (rawStatus === 'passed') {
              status = 'passed';
            }

            // Aggregate duration and error details from last result
            const lastResult = test.results && test.results.length > 0 ? test.results[test.results.length - 1] : undefined;
            const duration_ms = Math.round(lastResult?.duration || 0);

            let error_message: string | null = null;
            let stack_trace: string | null = null;

            if (lastResult?.errors && lastResult.errors.length > 0) {
              error_message = lastResult.errors
                .map((e) => e.message || '')
                .filter(Boolean)
                .join('\n')
                .trim() || 'Test assertion failed';
              stack_trace = lastResult.errors
                .map((e) => e.stack || e.message || '')
                .filter(Boolean)
                .join('\n\n')
                .trim() || error_message;
            }

            // Process screenshot attachments
            const attachments: IngestAttachmentInput[] = [];
            if (lastResult?.attachments && Array.isArray(lastResult.attachments)) {
              for (const att of lastResult.attachments) {
                const isImage =
                  att.contentType?.startsWith('image/') ||
                  att.name === 'screenshot' ||
                  att.path?.endsWith('.png') ||
                  att.path?.endsWith('.jpg') ||
                  att.path?.endsWith('.jpeg') ||
                  att.path?.endsWith('.webp');

                if (!isImage) continue;

                const mimeType = att.contentType || 'image/png';
                let base64Data = '';

                if (att.body && typeof att.body === 'string') {
                  base64Data = att.body;
                } else if (att.path && typeof att.path === 'string') {
                  try {
                    const resolvedPath = path.isAbsolute(att.path)
                      ? att.path
                      : path.resolve(options.cwd || process.cwd(), att.path);

                    if (fs.existsSync(resolvedPath)) {
                      const stats = fs.statSync(resolvedPath);
                      if (stats.size <= maxBytes) {
                        base64Data = fs.readFileSync(resolvedPath).toString('base64');
                      }
                    }
                  } catch {
                    // Ignore disk read error for missing screenshots
                  }
                }

                if (base64Data) {
                  attachments.push({
                    file_name: att.path ? path.basename(att.path) : (att.name || 'screenshot.png'),
                    mime_type: mimeType,
                    data_base64: base64Data,
                  });
                }
              }
            }

            results.push({
              automation_id,
              title: specTitle,
              suite_path: nextPath.length > 0 ? nextPath : undefined,
              tags: specTags.length > 0 ? specTags : undefined,
              status,
              duration_ms,
              error_message,
              stack_trace,
              attempt_number: test.results ? test.results.length : 1,
              attachments: attachments.length > 0 ? attachments : undefined,
            });
          }
        } else {
          // Spec without tests
          results.push({
            automation_id: file ? `${file}#${specTitle}` : specTitle,
            title: specTitle,
            suite_path: nextPath.length > 0 ? nextPath : undefined,
            tags: specTags.length > 0 ? specTags : undefined,
            status: spec.ok ? 'passed' : 'failed',
            duration_ms: 0,
          });
        }
      }
    }

    if (Array.isArray(suite.suites)) {
      for (const childSuite of suite.suites) {
        traverseSuite(childSuite, nextPath);
      }
    }
  }

  if (Array.isArray(report.suites)) {
    for (const rootSuite of report.suites) {
      traverseSuite(rootSuite, []);
    }
  }

  return results;
}
