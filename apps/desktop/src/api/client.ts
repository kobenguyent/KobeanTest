import type {
  TestCase,
  TestSuite,
  TestRun,
  TestExecution,
  Project,
  Workspace,
  TestStep,
} from '@kobean/core';

export class KobeanApiClient {
  private baseUrl: string;
  private token: string;

  constructor(port = 4000, token = '') {
    this.baseUrl = `http://127.0.0.1:${port}/api/v1`;
    this.token = token;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || `Request failed with ${res.status}`);
    }

    return res.json();
  }

  async getHealth(): Promise<{ status: string; version: string }> {
    const res = await fetch('http://127.0.0.1:4000/health');
    return res.json();
  }

  // Workspaces
  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/workspaces');
  }

  async createWorkspace(name: string, slug: string): Promise<Workspace> {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
  }

  // Projects
  async listProjects(workspaceId: string): Promise<Project[]> {
    return this.request<Project[]>('/projects', {
      headers: { 'X-Workspace-Id': workspaceId },
    });
  }

  async createProject(
    workspaceId: string,
    name: string,
    key: string,
    description?: string
  ): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, name, key, description }),
    });
  }

  // Suites
  async listSuites(projectId: string): Promise<TestSuite[]> {
    return this.request<TestSuite[]>(`/projects/${projectId}/suites`);
  }

  async createSuite(
    projectId: string,
    title: string,
    parentId?: string,
    description?: string
  ): Promise<TestSuite> {
    return this.request<TestSuite>(`/projects/${projectId}/suites`, {
      method: 'POST',
      body: JSON.stringify({ title, parent_id: parentId, description }),
    });
  }

  // Cases
  async listCases(projectId: string, suiteId?: string): Promise<TestCase[]> {
    const query = suiteId ? `?suite_id=${encodeURIComponent(suiteId)}` : '';
    return this.request<TestCase[]>(`/projects/${projectId}/cases${query}`);
  }

  async searchCases(projectId: string, query: string): Promise<any[]> {
    return this.request<any[]>(`/projects/${projectId}/search?q=${encodeURIComponent(query)}`);
  }

  async createCase(
    projectId: string,
    input: {
      title: string;
      suite_id?: string;
      priority?: string;
      type?: string;
      steps?: TestStep[];
      automation_id?: string;
    }
  ): Promise<TestCase> {
    return this.request<TestCase>(`/projects/${projectId}/cases`, {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        steps_json: input.steps ? JSON.stringify(input.steps) : '[]',
      }),
    });
  }

  // Runs
  async listRuns(projectId: string): Promise<TestRun[]> {
    return this.request<TestRun[]>(`/projects/${projectId}/runs`);
  }

  async createRun(projectId: string, title: string, caseIds: string[]): Promise<TestRun> {
    return this.request<TestRun>(`/projects/${projectId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ title, case_ids: caseIds }),
    });
  }

  async getRunDetails(runId: string): Promise<{ run: TestRun; items: any[] }> {
    return this.request<{ run: TestRun; items: any[] }>(`/runs/${runId}`);
  }

  async recordExecution(input: {
    run_item_id: string;
    status: 'passed' | 'failed' | 'blocked' | 'skipped';
    duration_ms?: number;
    notes?: string;
  }): Promise<TestExecution> {
    return this.request<TestExecution>('/executions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}

export const api = new KobeanApiClient();
