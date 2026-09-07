/**
 * KobeanTest Core Domain Types
 * Strict, immutable data contracts across Desktop (Tauri) and Localhost Web.
 */

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TestType = 'manual' | 'automated' | 'exploratory' | 'bdd';
export type ExecutionStatus = 'passed' | 'failed' | 'blocked' | 'skipped';
export type RunItemStatus = 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped';
export type RunStatus = 'in_progress' | 'completed' | 'aborted';
export type RunSource = 'manual' | 'ci' | 'scheduled';

export interface TestStep {
  step_number: number;
  action: string;
  expected: string;
  data?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  key: string; // e.g. "KB"
  description?: string | null;
  created_at: number;
  updated_at: number;
}

export interface TestSuite {
  id: string;
  project_id: string;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  position: number;
  created_at: number;
  updated_at: number;
}

export interface TestCase {
  id: string;
  project_id: string;
  suite_id?: string | null;
  case_number: number;
  title: string;
  preconditions?: string | null;
  steps: TestStep[];
  priority: Priority;
  type: TestType;
  automation_id?: string | null;
  tags: string[];
  is_flaky: boolean;
  is_archived: boolean;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface TestCaseRevision {
  id: string;
  case_id: string;
  project_id: string;
  version: number;
  title: string;
  preconditions?: string | null;
  steps: TestStep[];
  created_by?: string | null;
  created_at: number;
}

export interface TestRun {
  id: string;
  project_id: string;
  title: string;
  environment: string;
  source: RunSource;
  status: RunStatus;
  idempotency_key?: string | null;
  commit_sha?: string | null;
  branch?: string | null;
  total_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  blocked_count: number;
  created_at: number;
  completed_at?: number | null;
}

export interface TestRunItem {
  id: string;
  test_run_id: string;
  test_case_id: string;
  case_revision_id: string;
  status: RunItemStatus;
  assigned_to?: string | null;
}

export interface ExecutionStepResult {
  id: string;
  execution_id: string;
  step_number: number;
  status: ExecutionStatus;
  actual_result?: string | null;
}

export interface ExecutionAttachment {
  id: string;
  execution_id: string;
  step_number?: number | null;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: number;
}

export interface TestExecution {
  id: string;
  run_item_id: string;
  case_revision_id: string;
  attempt_number: number;
  status: ExecutionStatus;
  duration_ms: number;
  error_message?: string | null;
  stack_trace?: string | null;
  notes?: string | null;
  executed_by?: string | null;
  executed_at: number;
  step_results?: ExecutionStepResult[];
  attachments?: ExecutionAttachment[];
}

export interface IngestResultItem {
  automation_id: string;
  title: string;
  suite_path?: string[];
  status: ExecutionStatus;
  duration_ms?: number;
  error_message?: string | null;
  stack_trace?: string | null;
  attempt_number?: number;
}

export interface IngestBatchPayload {
  idempotency_key: string;
  run_name: string;
  commit_sha?: string | null;
  branch?: string | null;
  environment?: string;
  auto_create_cases?: boolean;
  results: IngestResultItem[];
}
