/**
 * KobeanTest Core Validation Schemas
 * Type-safe runtime validation contracts for test cases, runs, and ingestions.
 */

import type {
  ExecutionStatus,
  IngestBatchPayload,
  IngestResultItem,
  Priority,
  TestCase,
  TestExecution,
  TestRun,
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
      auto_create_cases: b.auto_create_cases !== false,
      results: b.results as IngestResultItem[],
    },
  };
}
