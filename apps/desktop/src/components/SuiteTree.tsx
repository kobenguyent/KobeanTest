import React, { useState } from 'react';
import type { TestSuite, RepoConnection } from '@kobean/core';

export interface SuiteTreeProps {
  suites: TestSuite[];
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string | null) => void;
  onCreateSuite: (
    title: string,
    parentId?: string,
    extra?: { repo_connection_id?: string; github_repo?: string; file_path?: string }
  ) => void;
  totalCasesCount: number;
  connections?: RepoConnection[];
}

export function SuiteTree({
  suites,
  selectedSuiteId,
  onSelectSuite,
  onCreateSuite,
  totalCasesCount,
  connections = [],
}: SuiteTreeProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [newFilePath, setNewFilePath] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      const conn = connections.find((c) => c.id === selectedRepoId);
      const extra = conn
        ? {
            repo_connection_id: conn.id,
            github_repo: conn.repo_name,
            file_path: newFilePath.trim() || undefined,
          }
        : undefined;

      onCreateSuite(newTitle.trim(), undefined, extra);
      setNewTitle('');
      setSelectedRepoId('');
      setNewFilePath('');
      setIsCreating(false);
    }
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-[var(--sidebar,var(--card-raised))] border-r border-[var(--border)] shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Suites & Hierarchy
        </span>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-100"
          title="Create Test Suite"
          aria-label="Create Test Suite"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Creation Input */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-2 border-b border-[var(--border)] bg-[var(--card)] flex flex-col gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="Suite title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsCreating(false);
            }}
            className="w-full text-[12px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)]"
            required
          />
          {connections.length > 0 && (
            <>
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="w-full text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] font-mono"
              >
                <option value="">Link GitHub Repo (optional)...</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.repo_name} ({c.default_branch || 'main'})
                  </option>
                ))}
              </select>
              {selectedRepoId && (
                <input
                  type="text"
                  placeholder="Test file path (e.g. tests/auth.spec.ts)"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  className="w-full text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              )}
            </>
          )}
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-2 py-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--text)] rounded border border-[var(--border)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-2 py-0.5 text-[10px] bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              Create Suite
            </button>
          </div>
        </form>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* All Cases Item */}
        <button
          type="button"
          onClick={() => onSelectSuite(null)}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[13px] transition-colors duration-100 ${
            selectedSuiteId === null
              ? 'bg-[var(--card)] text-[var(--text)] font-medium border border-[var(--border)]'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)]/50 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
            <span>All Test Cases</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums opacity-75">
            {totalCasesCount}
          </span>
        </button>

        {/* Suites List */}
        {suites.map((suite) => {
          const isSelected = selectedSuiteId === suite.id;
          const repo = suite.github_repo;
          const conn = connections.find(
            (c) => c.id === suite.repo_connection_id || (repo && c.repo_name === repo)
          );
          const branch = conn?.default_branch || 'main';
          const githubUrl = repo
            ? suite.file_path
              ? `https://github.com/${repo}/blob/${branch}/${suite.file_path}`
              : `https://github.com/${repo}/tree/${branch}`
            : null;

          return (
            <div
              key={suite.id}
              onClick={() => onSelectSuite(suite.id)}
              className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[13px] transition-colors duration-100 cursor-pointer ${
                isSelected
                  ? 'bg-[var(--card)] text-[var(--text)] font-medium border border-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)]/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted)]">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                <span className="truncate">{suite.title}</span>
              </div>

              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 p-1 rounded text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)] opacity-60 group-hover:opacity-100 transition-opacity"
                  title={`View on GitHub: ${repo}${suite.file_path ? ` (${suite.file_path})` : ''}`}
                  aria-label={`View ${suite.title} on GitHub`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
