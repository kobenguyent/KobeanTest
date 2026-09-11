import { useState } from 'react';
import type { TestRun, RepoConnection, GitHubAccount } from '@kobean/core';
import { StatusPill } from '@kobean/ui';

export interface BottomConsolePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  activeRun: TestRun | null;
  runItems: any[];
  onStartRun: () => void;
  onSelectExecutionView: () => void;
  casesCount: number;
  connections?: RepoConnection[];
  githubAccount?: GitHubAccount | null;
  activeTab?: 'triage' | 'daemon' | 'ingest' | 'connections';
  onTabChange?: (tab: 'triage' | 'daemon' | 'ingest' | 'connections') => void;
  onCreateConnection?: (input: {
    name: string;
    repo_name: string;
    repo_url: string;
    default_branch?: string;
  }) => Promise<void>;
  onDeleteConnection?: (id: string) => Promise<void>;
  onSaveGitHubAccount?: (input: {
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    token: string;
  }) => Promise<void>;
  onDeleteGitHubAccount?: () => Promise<void>;
}

export function BottomConsolePanel({
  isOpen,
  onClose,
  isOnline,
  activeRun,
  runItems,
  onStartRun,
  onSelectExecutionView,
  casesCount,
  connections = [],
  githubAccount = null,
  activeTab: controlledTab,
  onTabChange,
  onCreateConnection,
  onDeleteConnection,
  onSaveGitHubAccount,
  onDeleteGitHubAccount,
}: BottomConsolePanelProps) {
  const [internalTab, setInternalTab] = useState<'triage' | 'daemon' | 'ingest' | 'connections'>('triage');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (tab: 'triage' | 'daemon' | 'ingest' | 'connections') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [newConnName, setNewConnName] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newBranch, setNewBranch] = useState('main');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GitHub PAT Authentication state
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Counts for triage
  const passedCount = runItems.filter((i) => i.item.status === 'passed').length;
  const failedCount = runItems.filter((i) => i.item.status === 'failed').length;
  const blockedCount = runItems.filter((i) => i.item.status === 'blocked').length;
  const skippedCount = runItems.filter((i) => i.item.status === 'skipped').length;
  const pendingCount = runItems.filter((i) => i.item.status === 'pending').length;
  const totalCount = runItems.length || casesCount;
  const resolvedCount = passedCount + failedCount + blockedCount + skippedCount;
  const progressPercent = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  return (
    <div
      className="h-56 w-full border-t border-[var(--border)] bg-[var(--canvas)] flex flex-col shrink-0 select-none animate-in slide-in-from-bottom-2 duration-150 z-10"
      data-testid="bottom-console-panel"
    >
      {/* Panel Header */}
      <div className="h-8 px-3 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('triage')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 flex items-center gap-1.5 ${
              activeTab === 'triage'
                ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>⚡ Runner Triage</span>
            {activeRun && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)] tabular-nums">
                {progressPercent}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('daemon')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 flex items-center gap-1.5 ${
              activeTab === 'daemon'
                ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>🖥 Local Daemon</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? 'bg-[var(--status-pass)]' : 'bg-[var(--muted)]'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ingest')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 flex items-center gap-1.5 ${
              activeTab === 'ingest'
                ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>📥 CI Ingest</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 flex items-center gap-1.5 ${
              activeTab === 'connections'
                ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <span>{githubAccount ? `@${githubAccount.login}` : 'GitHub Repos'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--card)] text-[var(--muted)] border border-[var(--border)] tabular-nums">
              {connections.length}
            </span>
          </button>
        </div>

        {/* Panel Actions */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--muted)]">⌘J to toggle</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bottom Panel"
            title="Close Panel (⌘J)"
            className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] rounded-md hover:bg-[var(--canvas)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3.5 overflow-y-auto font-sans">
        {activeTab === 'triage' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold tracking-tight text-[var(--text)]">
                  {activeRun ? activeRun.title : 'No Test Run Active'}
                </span>
                {activeRun && (
                  <span className="text-[11px] font-mono text-[var(--muted)] tabular-nums">
                    {resolvedCount} / {totalCount} resolved ({progressPercent}%)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeRun ? (
                  <button
                    type="button"
                    onClick={onSelectExecutionView}
                    className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Open Execution View →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStartRun}
                    className="px-2 py-0.5 text-[11px] font-medium bg-[var(--card)] hover:bg-[var(--border)]/30 border border-[var(--border)] text-[var(--text)] rounded transition-colors"
                  >
                    ▶ Launch Run
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-[var(--card)] border border-[var(--border)]/50 overflow-hidden flex">
              <div
                className="bg-[var(--status-pass)] transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (passedCount / totalCount) * 100 : 0}%` }}
              />
              <div
                className="bg-[var(--status-fail)] transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (failedCount / totalCount) * 100 : 0}%` }}
              />
              <div
                className="bg-[var(--status-blocked)] transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (blockedCount / totalCount) * 100 : 0}%` }}
              />
            </div>

            {/* Status Pills Summary */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <StatusPill status="passed" count={passedCount} />
              <StatusPill status="failed" count={failedCount} />
              <StatusPill status="blocked" count={blockedCount} />
              <StatusPill status="skipped" count={skippedCount} />
              <StatusPill status="pending" count={pendingCount} />
            </div>
          </div>
        )}

        {activeTab === 'daemon' && (
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)]/60 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted)]">Daemon Endpoint</span>
              <span className="font-mono text-[var(--text)]">http://127.0.0.1:4000</span>
              <span className="text-[10px] text-[var(--muted)]">Loopback Bearer Isolated</span>
            </div>

            <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)]/60 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted)]">Storage Engine</span>
              <span className="font-mono text-[var(--text)]">SQLite 3 (WAL Mode)</span>
              <span className="text-[10px] text-[var(--muted)]">0600 POSIX File Security</span>
            </div>

            <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)]/60 flex flex-col gap-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted)]">Search Index</span>
              <span className="font-mono text-[var(--text)]">FTS5 Full-Text Search</span>
              <span className="text-[10px] text-[var(--status-pass)]">Latency: &lt; 5ms (SLA OK)</span>
            </div>
          </div>
        )}

        {activeTab === 'ingest' && (
          <div className="flex flex-col gap-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text)] font-medium">
                Universal Test Result Ingest (Endpoint: <code className="font-mono text-[10px]">/api/v1/ingest</code>)
              </span>
              <span className="text-[10px] text-[var(--muted)]">Supports JUnit, Playwright, Cucumber</span>
            </div>

            <div className="p-2 rounded bg-[var(--card)] border border-[var(--border)] font-mono text-[10px] text-[var(--text)] select-text">
              <code>npx kobean run --playwright "npx playwright test"</code>
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="flex flex-col gap-3 text-[11px] h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold tracking-tight text-[var(--text)]">
                  GitHub Connections
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] font-mono">
                  100% Localhost • Zero Telemetry
                </span>
                {githubAccount && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[10.5px]">
                    {githubAccount.avatar_url ? (
                      <img src={githubAccount.avatar_url} alt={githubAccount.login} className="w-3.5 h-3.5 rounded-full object-cover" />
                    ) : (
                      <span>🐙</span>
                    )}
                    <span className="font-semibold text-[var(--text)]">@{githubAccount.login}</span>
                    <span className="font-mono text-[var(--muted)] text-[9.5px]">{githubAccount.token_masked}</span>
                    {onDeleteGitHubAccount && (
                      <button
                        type="button"
                        onClick={onDeleteGitHubAccount}
                        className="text-[var(--status-fail)] hover:underline text-[9.5px] ml-1"
                        title="Disconnect GitHub Account"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!githubAccount && (
                  <button
                    type="button"
                    onClick={() => setShowAuthForm((prev) => !prev)}
                    className="px-2 py-0.5 text-[11px] font-medium bg-[var(--card)] hover:bg-[var(--border)]/30 border border-[var(--border)] text-[var(--text)] rounded transition-colors"
                  >
                    {showAuthForm ? 'Close Login' : '🐙 Connect GitHub (Optional)'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddingConnection((prev) => !prev)}
                  className="px-2 py-0.5 text-[11px] font-medium bg-[var(--card)] hover:bg-[var(--border)]/30 border border-[var(--border)] text-[var(--text)] rounded transition-colors"
                >
                  {isAddingConnection ? 'Cancel' : '+ Connect Repository'}
                </button>
              </div>
            </div>

            {/* Optional GitHub PAT Login Form */}
            {showAuthForm && !githubAccount && (
              <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text)]">Authenticate GitHub Personal Access Token (PAT)</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=KobeanTest%20Localhost"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-[var(--accent)] hover:underline"
                  >
                    Generate Token on GitHub ↗
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="ghp_... or github_pat_..."
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    className="flex-1 text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] font-mono"
                  />
                  <button
                    type="button"
                    disabled={isAuthenticating || !patInput.trim()}
                    onClick={async () => {
                      if (!patInput.trim() || !onSaveGitHubAccount) return;
                      setIsAuthenticating(true);
                      setAuthError(null);
                      try {
                        const ghRes = await fetch('https://api.github.com/user', {
                          headers: {
                            Authorization: `Bearer ${patInput.trim()}`,
                            Accept: 'application/vnd.github.v3+json',
                          },
                        });
                        if (!ghRes.ok) {
                          throw new Error(`GitHub token verification failed (${ghRes.status})`);
                        }
                        const ghUser = await ghRes.json();
                        await onSaveGitHubAccount({
                          login: ghUser.login,
                          name: ghUser.name || ghUser.login,
                          avatar_url: ghUser.avatar_url,
                          token: patInput.trim(),
                        });
                        setPatInput('');
                        setShowAuthForm(false);
                      } catch (err: any) {
                        setAuthError(err.message || 'Verification failed');
                      } finally {
                        setIsAuthenticating(false);
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
                  >
                    {isAuthenticating ? 'Verifying...' : 'Authenticate'}
                  </button>
                </div>
                {authError && <div className="text-[10px] text-[var(--status-fail)]">{authError}</div>}
              </div>
            )}

            {/* Inline Add Connection Form */}
            {isAddingConnection && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newRepoName.trim() || !onCreateConnection) return;
                  setIsSubmitting(true);
                  try {
                    const cleanRepo = newRepoName.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
                    const name = newConnName.trim() || cleanRepo;
                    const repoUrl = `https://github.com/${cleanRepo}`;
                    await onCreateConnection({
                      name,
                      repo_name: cleanRepo,
                      repo_url: repoUrl,
                      default_branch: newBranch.trim() || 'main',
                    });
                    setNewConnName('');
                    setNewRepoName('');
                    setNewBranch('main');
                    setIsAddingConnection(false);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)] flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="owner/repo (e.g. facebook/react)"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Connection name (optional)"
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  className="text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="text"
                  placeholder="Branch"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-20 text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] font-mono"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newRepoName.trim()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Linking...' : 'Save Connection'}
                </button>
              </form>
            )}

            {/* List of Connections */}
            {connections.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 rounded border border-dashed border-[var(--border)] text-[var(--muted)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-60">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                <p className="text-[12px] font-medium text-[var(--text)]">No GitHub Repositories Linked</p>
                <p className="text-[11px] text-[var(--muted)] max-w-sm mt-0.5">
                  Link your GitHub repo to inspect suite source files, navigate tests directly on GitHub, and correlate CI test runs to Pull Requests.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)]/70 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--text)]">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                      </svg>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-[12px] text-[var(--text)] truncate">
                            {conn.repo_name}
                          </span>
                          <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--canvas)] border border-[var(--border)] text-[var(--muted)] font-mono">
                            {conn.default_branch || 'main'}
                          </span>
                        </div>
                        {conn.name !== conn.repo_name && (
                          <span className="text-[10px] text-[var(--muted)] truncate">{conn.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={conn.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 text-[10px] font-medium rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)] transition-colors"
                        title={`Open ${conn.repo_url} in browser`}
                      >
                        ↗ GitHub
                      </a>
                      {onDeleteConnection && (
                        <button
                          type="button"
                          onClick={() => onDeleteConnection(conn.id)}
                          className="p-1 rounded text-[var(--muted)] hover:text-[var(--status-fail)] hover:bg-[var(--status-fail)]/10 transition-colors"
                          title="Unlink Repository"
                          aria-label={`Unlink ${conn.repo_name}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
