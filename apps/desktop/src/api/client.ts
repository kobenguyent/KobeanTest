import type {
  TestCase,
  TestSuite,
  TestRun,
  TestExecution,
  Project,
  Workspace,
  TestStep,
  RepoConnection,
  GitHubAccount,
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
    description?: string,
    extra?: {
      position?: number;
      repo_connection_id?: string;
      github_repo?: string;
      file_path?: string;
    }
  ): Promise<TestSuite> {
    return this.request<TestSuite>(`/projects/${projectId}/suites`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        parent_id: parentId,
        description,
        ...extra,
      }),
    });
  }

  async updateSuite(
    suiteId: string,
    input: {
      title: string;
      parent_id?: string;
      description?: string;
      position?: number;
      repo_connection_id?: string;
      github_repo?: string;
      file_path?: string;
    }
  ): Promise<TestSuite> {
    return this.request<TestSuite>(`/suites/${suiteId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteSuite(suiteId: string): Promise<{ status: string; deleted: boolean }> {
    return this.request<{ status: string; deleted: boolean }>(`/suites/${suiteId}`, {
      method: 'DELETE',
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

  async getCase(caseId: string): Promise<TestCase> {
    return this.request<TestCase>(`/cases/${caseId}`);
  }

  async updateCase(
    caseId: string,
    input: {
      title?: string;
      suite_id?: string;
      priority?: string;
      type?: string;
      preconditions?: string;
      steps?: TestStep[];
      tags?: string[];
      automation_id?: string;
      is_flaky?: boolean;
      is_archived?: boolean;
    }
  ): Promise<TestCase> {
    const payload: Record<string, unknown> = { ...input };
    if (input.steps) {
      payload['steps_json'] = JSON.stringify(input.steps);
    }
    if (input.tags) {
      payload['tags_json'] = JSON.stringify(input.tags);
    }
    return this.request<TestCase>(`/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteCase(caseId: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/cases/${caseId}`, {
      method: 'DELETE',
    });
  }

  async getCaseRevisions(caseId: string): Promise<any[]> {
    return this.request<any[]>(`/cases/${caseId}/revisions`);
  }

  // Runs
  async listRuns(projectId: string): Promise<TestRun[]> {
    return this.request<TestRun[]>(`/projects/${projectId}/runs`);
  }

  async createRun(
    projectId: string,
    title: string,
    caseIds: string[],
    extra?: {
      environment?: string;
      source?: string;
      commit_sha?: string;
      branch?: string;
      repo_connection_id?: string;
      github_repo?: string;
      pull_request_number?: number;
      pull_request_url?: string;
    }
  ): Promise<TestRun> {
    return this.request<TestRun>(`/projects/${projectId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ title, case_ids: caseIds, ...extra }),
    });
  }

  async getRunDetails(runId: string): Promise<{ run: TestRun; items: any[] }> {
    return this.request<{ run: TestRun; items: any[] }>(`/runs/${runId}`);
  }

  async recordExecution(input: {
    run_item_id: string;
    status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'pending';
    duration_ms?: number;
    notes?: string;
  }): Promise<TestExecution> {
    return this.request<TestExecution>('/executions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Attachments & Media
  async uploadAttachment(
    executionId: string,
    input: {
      step_number?: number;
      file_name?: string;
      mime_type?: string;
      data_base64: string;
    }
  ): Promise<any> {
    return this.request<any>(`/executions/${executionId}/attachments/upload`, {
      method: 'POST',
      body: JSON.stringify({
        file_name: input.file_name || 'screenshot.png',
        mime_type: input.mime_type || 'image/png',
        step_number: input.step_number,
        data_base64: input.data_base64,
      }),
    });
  }

  async listAttachments(executionId: string): Promise<any[]> {
    return this.request<any[]>(`/executions/${executionId}/attachments`);
  }

  // Connections (GitHub)
  async listConnections(projectId: string): Promise<RepoConnection[]> {
    return this.request<RepoConnection[]>(`/projects/${projectId}/connections`);
  }

  async createConnection(
    projectId: string,
    input: {
      name: string;
      repo_name: string;
      repo_url: string;
      default_branch?: string;
    }
  ): Promise<RepoConnection> {
    return this.request<RepoConnection>(`/projects/${projectId}/connections`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateConnection(
    connectionId: string,
    input: {
      name: string;
      repo_name: string;
      repo_url: string;
      default_branch?: string;
    }
  ): Promise<RepoConnection> {
    return this.request<RepoConnection>(`/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteConnection(connectionId: string): Promise<{ status: string; deleted: boolean }> {
    return this.request<{ status: string; deleted: boolean }>(`/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  // GitHub Account Authentication
  async getGitHubAccount(): Promise<GitHubAccount | null> {
    return this.request<GitHubAccount | null>('/github/account');
  }

  async saveGitHubAccount(input: {
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    token: string;
  }): Promise<GitHubAccount> {
    return this.request<GitHubAccount>('/github/account', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async deleteGitHubAccount(): Promise<{ status: string; deleted: boolean }> {
    return this.request<{ status: string; deleted: boolean }>('/github/account', {
      method: 'DELETE',
    });
  }

  getMediaUrl(filePathOrName: string): string {
    const filename = filePathOrName.split(/[/\\]/).pop() || filePathOrName;
    const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    return `${this.baseUrl}/media/${filename}${tokenQuery}`;
  }
}

export const api = new KobeanApiClient();
