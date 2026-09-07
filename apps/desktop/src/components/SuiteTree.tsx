import React, { useState } from 'react';
import type { TestSuite } from '@kobean/core';

export interface SuiteTreeProps {
  suites: TestSuite[];
  selectedSuiteId: string | null;
  onSelectSuite: (suiteId: string | null) => void;
  onCreateSuite: (title: string, parentId?: string) => void;
  totalCasesCount: number;
}

export function SuiteTree({
  suites,
  selectedSuiteId,
  onSelectSuite,
  onCreateSuite,
  totalCasesCount,
}: SuiteTreeProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateSuite(newTitle.trim());
      setNewTitle('');
      setIsCreating(false);
    }
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-[var(--canvas)] border-r border-[var(--border)] shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Suites & Hierarchy
        </span>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="p-1 rounded text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-100"
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
        <form onSubmit={handleCreate} className="p-2 border-b border-[var(--border)] bg-[var(--card)]">
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
          />
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
          return (
            <button
              key={suite.id}
              type="button"
              onClick={() => onSelectSuite(suite.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[13px] transition-colors duration-100 ${
                isSelected
                  ? 'bg-[var(--card)] text-[var(--text)] font-medium border border-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)]/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--muted)]">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
                <span className="truncate">{suite.title}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
