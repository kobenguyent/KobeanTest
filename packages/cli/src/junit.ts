export interface ParsedJunitCase {
  automation_id: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'blocked';
  duration_ms: number;
  error_message?: string;
  stack_trace?: string;
}

/**
 * Lightweight zero-dependency JUnit XML parser adhering to Ponytail minimalism.
 * Safely extracts test cases, failures, skips, and execution times without external XML parsers.
 */
export function parseJunitXml(xmlContent: string): ParsedJunitCase[] {
  const results: ParsedJunitCase[] = [];

  // Match each <testcase ...> ... </testcase> or self-closing <testcase ... />
  const testcaseRegex = /<testcase\b([^>]*?)>(.*?)(?:<\/testcase>)|<testcase\b([^>]*?)\/>/gis;
  let match: RegExpExecArray | null;

  while ((match = testcaseRegex.exec(xmlContent)) !== null) {
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
      status,
      duration_ms,
      ...(error_message ? { error_message } : {}),
      ...(stack_trace ? { stack_trace } : {}),
    });
  }

  return results;
}
