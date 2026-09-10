/**
 * KobeanTest Core Validation Schemas
 * Type-safe runtime validation contracts for test cases, runs, and ingestions.
 */

import type {
  ExecutionStatus,
  IngestBatchPayload,
  IngestResultItem,
  Priority,
  RepoConnection,
  TestCase,
  TestStep,
  TestSuite,
  TestType,
} from './types.ts';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export function validateTestStep(input: unknown): ValidationResult<TestStep> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: ['TestStep must be an object'] };
  }

  const s = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof s.step_number !== 'number' || !Number.isInteger(s.step_number) || s.step_number <= 0) {
    errors.push('step_number must be a positive integer');
  }
  if (typeof s.action !== 'string' || s.action.trim().length === 0) {
    errors.push('action cannot be empty');
  }
  if (typeof s.expected !== 'string' || s.expected.trim().length === 0) {
    errors.push('expected cannot be empty');
  }
  if (s.data !== undefined && typeof s.data !== 'string') {
    errors.push('data must be a string if provided');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      step_number: s.step_number as number,
      action: (s.action as string).trim(),
      expected: (s.expected as string).trim(),
      data: s.data as string | undefined,
    },
  };
}

export const VALID_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
export const VALID_TYPES: TestType[] = ['manual', 'automated', 'exploratory', 'bdd'];
export const VALID_EXECUTION_STATUSES: ExecutionStatus[] = ['passed', 'failed', 'blocked', 'skipped'];

export function validateTestCase(input: unknown): ValidationResult<TestCase> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: ['TestCase must be an object'] };
  }

  const c = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof c.id !== 'string' || c.id.trim().length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof c.project_id !== 'string' || c.project_id.trim().length === 0) {
    errors.push('project_id must be a non-empty string');
  }
  if (typeof c.case_number !== 'number' || !Number.isInteger(c.case_number) || c.case_number <= 0) {
    errors.push('case_number must be a positive integer');
  }
  if (typeof c.title !== 'string' || c.title.trim().length === 0) {
    errors.push('title cannot be empty');
  }
  if (!Array.isArray(c.steps)) {
    errors.push('steps must be an array');
  } else {
    c.steps.forEach((step, idx) => {
      const stepVal = validateTestStep(step);
      if (!stepVal.success) {
        errors.push(`Step ${idx + 1}: ${stepVal.errors?.join(', ')}`);
      }
    });
  }
  if (typeof c.priority !== 'string' || !VALID_PRIORITIES.includes(c.priority as Priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (typeof c.type !== 'string' || !VALID_TYPES.includes(c.type as TestType)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      id: c.id as string,
      project_id: c.project_id as string,
      suite_id: (c.suite_id as string) || null,
      case_number: c.case_number as number,
      title: (c.title as string).trim(),
      preconditions: typeof c.preconditions === 'string' ? c.preconditions.trim() : null,
      steps: c.steps as TestStep[],
      priority: c.priority as Priority,
      type: c.type as TestType,
      automation_id: typeof c.automation_id === 'string' ? c.automation_id.trim() : null,
      tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
      is_flaky: Boolean(c.is_flaky),
      is_archived: Boolean(c.is_archived),
      version: typeof c.version === 'number' && c.version > 0 ? c.version : 1,
      created_at: typeof c.created_at === 'number' ? c.created_at : Date.now(),
      updated_at: typeof c.updated_at === 'number' ? c.updated_at : Date.now(),
    },
  };
}

export function validateRepoConnection(input: unknown): ValidationResult<RepoConnection> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: ['RepoConnection must be an object'] };
  }

  const r = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof r.id !== 'string' || r.id.trim().length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof r.project_id !== 'string' || r.project_id.trim().length === 0) {
    errors.push('project_id must be a non-empty string');
  }
  if (typeof r.name !== 'string' || r.name.trim().length === 0) {
    errors.push('name cannot be empty');
  }
  if (r.provider !== undefined && r.provider !== 'github') {
    errors.push("provider must be 'github'");
  }
  if (typeof r.repo_name !== 'string' || r.repo_name.trim().length === 0) {
    errors.push('repo_name cannot be empty (e.g. owner/repo)');
  }
  if (typeof r.repo_url !== 'string' || r.repo_url.trim().length === 0) {
    errors.push('repo_url cannot be empty');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      id: (r.id as string).trim(),
      project_id: (r.project_id as string).trim(),
      name: (r.name as string).trim(),
      provider: 'github',
      repo_name: (r.repo_name as string).trim(),
      repo_url: (r.repo_url as string).trim(),
      default_branch:
        typeof r.default_branch === 'string' && r.default_branch.trim().length > 0
          ? (r.default_branch as string).trim()
          : 'main',
      created_at: typeof r.created_at === 'number' ? r.created_at : Date.now(),
      updated_at: typeof r.updated_at === 'number' ? r.updated_at : Date.now(),
    },
  };
}

export function validateTestSuite(input: unknown): ValidationResult<TestSuite> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: ['TestSuite must be an object'] };
  }

  const s = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof s.id !== 'string' || s.id.trim().length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (typeof s.project_id !== 'string' || s.project_id.trim().length === 0) {
    errors.push('project_id must be a non-empty string');
  }
  if (typeof s.title !== 'string' || s.title.trim().length === 0) {
    errors.push('title cannot be empty');
  }
  // Hierarchy cycle guard
  if (typeof s.parent_id === 'string' && s.parent_id === s.id) {
    errors.push('parent_id cannot reference the suite itself (cycle detected)');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      id: s.id as string,
      project_id: s.project_id as string,
      parent_id: typeof s.parent_id === 'string' ? s.parent_id : null,
      title: (s.title as string).trim(),
      description: typeof s.description === 'string' ? s.description.trim() : null,
      position: typeof s.position === 'number' ? s.position : 0,
      repo_connection_id: typeof s.repo_connection_id === 'string' ? s.repo_connection_id.trim() : null,
      github_repo: typeof s.github_repo === 'string' ? s.github_repo.trim() : null,
      file_path: typeof s.file_path === 'string' ? s.file_path.trim() : null,
      created_at: typeof s.created_at === 'number' ? s.created_at : Date.now(),
      updated_at: typeof s.updated_at === 'number' ? s.updated_at : Date.now(),
    },
  };
}

export function validateIngestBatchPayload(input: unknown): ValidationResult<IngestBatchPayload> {
  if (typeof input !== 'object' || input === null) {
    return { success: false, errors: ['IngestBatchPayload must be an object'] };
  }

  const b = input as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.idempotency_key !== 'string' || b.idempotency_key.trim().length === 0) {
    errors.push('idempotency_key is required to prevent duplicate runs on retries');
  }
  if (typeof b.run_name !== 'string' || b.run_name.trim().length === 0) {
    errors.push('run_name cannot be empty');
  }
  if (!Array.isArray(b.results)) {
    errors.push('results must be an array of test execution items');
  } else if (b.results.length === 0) {
    errors.push('results cannot be empty');
  } else {
    b.results.forEach((item, idx) => {
      const res = item as Record<string, unknown>;
      if (typeof res.automation_id !== 'string' || res.automation_id.trim().length === 0) {
        errors.push(`Item ${idx + 1}: automation_id cannot be empty`);
      }
      if (typeof res.title !== 'string' || res.title.trim().length === 0) {
        errors.push(`Item ${idx + 1}: title cannot be empty`);
      }
      if (typeof res.status !== 'string' || !VALID_EXECUTION_STATUSES.includes(res.status as ExecutionStatus)) {
        errors.push(`Item ${idx + 1}: status must be one of: ${VALID_EXECUTION_STATUSES.join(', ')}`);
      }
      if (res.suite_path !== undefined && !Array.isArray(res.suite_path)) {
        errors.push(`Item ${idx + 1}: suite_path must be an array of strings`);
      }
      if (res.tags !== undefined && !Array.isArray(res.tags)) {
        errors.push(`Item ${idx + 1}: tags must be an array of strings`);
      }
      if (res.attachments !== undefined) {
        if (!Array.isArray(res.attachments)) {
          errors.push(`Item ${idx + 1}: attachments must be an array`);
        } else {
          res.attachments.forEach((att: unknown, attIdx: number) => {
            if (typeof att !== 'object' || att === null) {
              errors.push(`Item ${idx + 1} Attachment ${attIdx + 1}: must be an object`);
            } else {
              const a = att as Record<string, unknown>;
              if (typeof a.file_name !== 'string' || a.file_name.trim().length === 0) {
                errors.push(`Item ${idx + 1} Attachment ${attIdx + 1}: file_name cannot be empty`);
              }
              if (typeof a.mime_type !== 'string' || a.mime_type.trim().length === 0) {
                errors.push(`Item ${idx + 1} Attachment ${attIdx + 1}: mime_type cannot be empty`);
              }
              if (typeof a.data_base64 !== 'string' || a.data_base64.trim().length === 0) {
                errors.push(`Item ${idx + 1} Attachment ${attIdx + 1}: data_base64 cannot be empty`);
              }
            }
          });
        }
      }
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      idempotency_key: (b.idempotency_key as string).trim(),
      run_name: (b.run_name as string).trim(),
      commit_sha: typeof b.commit_sha === 'string' ? b.commit_sha.trim() : null,
      branch: typeof b.branch === 'string' ? b.branch.trim() : null,
      environment: typeof b.environment === 'string' ? b.environment.trim() : 'local',
      repo_connection_id: typeof b.repo_connection_id === 'string' ? b.repo_connection_id.trim() : null,
      github_repo: typeof b.github_repo === 'string' ? b.github_repo.trim() : null,
      pull_request_number: typeof b.pull_request_number === 'number' ? b.pull_request_number : null,
      pull_request_url: typeof b.pull_request_url === 'string' ? b.pull_request_url.trim() : null,
      auto_create_cases: b.auto_create_cases !== false,
      results: b.results as IngestResultItem[],
    },
  };
}
