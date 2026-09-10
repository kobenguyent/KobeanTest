import type { IngestResultItem, IngestAttachmentInput } from '@kobean/core';

interface RawCucumberStep {
  keyword?: string;
  name?: string;
  result?: {
    status?: string;
    duration?: number; // nanoseconds
    error_message?: string;
  };
  embeddings?: Array<{
    mime_type?: string;
    data?: string;
  }>;
}

interface RawCucumberElement {
  id?: string;
  name?: string;
  type?: string;
  keyword?: string;
  tags?: Array<{ name?: string }>;
  steps?: RawCucumberStep[];
}

interface RawCucumberFeature {
  uri?: string;
  id?: string;
  name?: string;
  description?: string;
  elements?: RawCucumberElement[];
}

/**
 * Zero-dependency Cucumber JSON report parser adhering to Ponytail minimalism.
 * Maps BDD features to suite paths, scenarios to test cases, aggregates step durations,
 * and extracts embedded screenshots from step failure embeddings.
 */
export function parseCucumberJson(input: string | object): IngestResultItem[] {
  let features: RawCucumberFeature[];
  if (typeof input === 'string') {
    if (!input.trim()) return [];
    try {
      features = JSON.parse(input) as RawCucumberFeature[];
    } catch {
      return [];
    }
  } else if (Array.isArray(input)) {
    features = input as RawCucumberFeature[];
  } else {
    return [];
  }

  if (!Array.isArray(features)) return [];

  const results: IngestResultItem[] = [];

  for (const feature of features) {
    const featureName = feature.name?.trim() || 'Untitled Feature';
    const suite_path = [featureName];
    const uri = feature.uri || '';

    if (!Array.isArray(feature.elements)) continue;

    for (const element of feature.elements) {
      if (element.type && element.type !== 'scenario') {
        continue;
      }

      const scenarioName = element.name?.trim() || 'Untitled Scenario';
      const automation_id = uri ? `${uri}#${scenarioName}` : scenarioName;

      // Extract tags
      const tags: string[] = [];
      if (Array.isArray(element.tags)) {
        for (const t of element.tags) {
          if (t.name) tags.push(t.name.trim());
        }
      }

      // Check title for inline tags
      const tagMatches = scenarioName.match(/@[\w-]+/g);
      if (tagMatches) {
        for (const m of tagMatches) {
          if (!tags.includes(m)) tags.push(m);
        }
      }

      let totalDurationNano = 0;
      let scenarioStatus: 'passed' | 'failed' | 'skipped' | 'blocked' = 'passed';
      let error_message: string | null = null;
      let stack_trace: string | null = null;
      const attachments: IngestAttachmentInput[] = [];

      if (Array.isArray(element.steps)) {
        for (let idx = 0; idx < element.steps.length; idx++) {
          const step = element.steps[idx]!;
          if (step.result?.duration) {
            totalDurationNano += step.result.duration;
          }

          const stepStatus = step.result?.status;
          if (stepStatus === 'failed') {
            scenarioStatus = 'failed';
            if (!error_message && step.result?.error_message) {
              const fullMsg = step.result.error_message;
              error_message = fullMsg.split('\n')[0]?.trim() || `Failed at step: ${step.keyword || ''}${step.name || ''}`;
              stack_trace = fullMsg.trim();
            }
          } else if (stepStatus === 'skipped' || stepStatus === 'pending' || stepStatus === 'undefined') {
            if (scenarioStatus !== 'failed') {
              scenarioStatus = 'skipped';
            }
          }

          // Check embeddings on this step
          if (Array.isArray(step.embeddings)) {
            for (const emb of step.embeddings) {
              if (emb.mime_type?.startsWith('image/') && emb.data) {
                attachments.push({
                  file_name: `step-${idx + 1}-screenshot.png`,
                  mime_type: emb.mime_type,
                  data_base64: emb.data,
                  step_number: idx + 1,
                });
              }
            }
          }
        }
      }

      const duration_ms = Math.round(totalDurationNano / 1_000_000);

      results.push({
        automation_id,
        title: scenarioName,
        suite_path,
        tags: tags.length > 0 ? tags : undefined,
        status: scenarioStatus,
        duration_ms,
        error_message,
        stack_trace,
        attempt_number: 1,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    }
  }

  return results;
}
