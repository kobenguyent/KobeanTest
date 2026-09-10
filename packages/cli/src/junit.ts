import type { IngestResultItem } from '@kobean/core';

export interface ParsedJunitCase extends IngestResultItem {}

/**
 * Lightweight zero-dependency JUnit XML parser adhering to Ponytail minimalism.
 * Safely extracts test suites, cases, failures, skips, tags, and execution times without external XML parsers.
 */
export function parseJunitXml(xmlContent: string): ParsedJunitCase[] {
  const results: ParsedJunitCase[] = [];

  // Match each testsuite block if present, or fall back to matching testcases directly
  const suiteRegex = /<testsuite\b([^>]*?)>(.*?)(?:<\/testsuite>)/gis;
  let suiteMatch: RegExpExecArray | null;
  let hasSuites = false;

  while ((suiteMatch = suiteRegex.exec(xmlContent)) !== null) {
    hasSuites = true;
    const suiteAttrs = suiteMatch[1] || '';
    const suiteBody = suiteMatch[2] || '';

    const suiteNameMatch = /\bname=["']([^"']+)["']/i.exec(suiteAttrs);
    const suiteName = suiteNameMatch?.[1]?.trim();
    const suite_path = suiteName ? [suiteName] : undefined;

    parseTestcases(suiteBody, suite_path, results);
  }

  // If no <testsuite> tag was found, parse all <testcase> tags in the document
  if (!hasSuites) {
    parseTestcases(xmlContent, undefined, results);
  }

  return results;
}

function parseTestcases(content: string, suite_path: string[] | undefined, results: ParsedJunitCase[]) {
  const testcaseRegex = /<testcase\b([^>]*?)>(.*?)(?:<\/testcase>)|<testcase\b([^>]*?)\/>/gis;
  let match: RegExpExecArray | null;

  while ((match = testcaseRegex.exec(content)) !== null) {
    const attrString = match[1] || match[3] || '';
    const body = match[2] || '';

    // Extract attributes with word boundaries
    const nameMatch = /\bname=["']([^"']+)["']/i.exec(attrString);
    const classnameMatch = /\bclassname=["']([^"']+)["']/i.exec(attrString);
    const timeMatch = /\btime=["']([^"']+)["']/i.exec(attrString);

    const title = nameMatch?.[1]?.trim() || 'Untitled Test';
    const classname = classnameMatch?.[1]?.trim() || '';
    const timeSec = parseFloat(timeMatch?.[1] || '0') || 0;
    const duration_ms = Math.round(timeSec * 1000);

    const automation_id = classname ? `${classname}#${title}` : title;

    // Extract tags from title
    const tags: string[] = [];
    const tagMatches = title.match(/@[\w-]+/g);
    if (tagMatches) {
      for (const m of tagMatches) {
        if (!tags.includes(m)) tags.push(m);
      }
    }

    // Check failure, error, or skipped
    const failureMatch = /<failure\b([^>]*?)>(.*?)(?:<\/failure>)|<failure\b([^>]*?)\/>/is.exec(body);
    const errorMatch = /<error\b([^>]*?)>(.*?)(?:<\/error>)|<error\b([^>]*?)\/>/is.exec(body);
    const skippedMatch = /<skipped\b/i.test(body) || /<skipped\b/i.test(attrString);

    let status: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';
    let error_message: string | undefined;
    let stack_trace: string | undefined;

    if (failureMatch || errorMatch) {
      status = 'failed';
      const m = failureMatch || errorMatch;
      const failAttrs = m?.[1] || m?.[3] || '';
      const failBody = m?.[2] || '';

      const msgMatch = /message=["']([^"']+)["']/i.exec(failAttrs);
      error_message = msgMatch?.[1] || failBody.trim().split('\n')[0] || 'Test assertion failed';
      stack_trace = failBody.trim() || error_message;
    } else if (skippedMatch) {
      status = 'skipped';
    }

    results.push({
      automation_id,
      title,
      suite_path,
      tags: tags.length > 0 ? tags : undefined,
      status,
      duration_ms,
      ...(error_message ? { error_message } : {}),
      ...(stack_trace ? { stack_trace } : {}),
    });
  }
}
