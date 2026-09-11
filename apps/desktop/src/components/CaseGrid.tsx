import { useEffect, useState } from 'react';
import type { TestCase } from '@kobean/core';
import { StatusPill, Select } from '@kobean/ui';

export interface CaseGridProps {
  cases: TestCase[];
  selectedCaseId: string | null;
  onSelectCase: (caseItem: TestCase) => void;
  onOpenNewCase: () => void;
  projectKey: string;
  onTriggerSearch: () => void;
}

export function CaseGrid({
  cases,
  selectedCaseId,
  onSelectCase,
  onOpenNewCase,
  projectKey,
  onTriggerSearch,
}: CaseGridProps) {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const filtered = cases.filter((c) => {
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    const testType = c.type || c.type_;
    if (filterType !== 'all' && testType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        `${projectKey}-${c.case_number}`.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Keyboard navigation (J / K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(filtered.length - 1, prev + 1);
          const item = filtered[next];
          if (item) onSelectCase(item);
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          const item = filtered[next];
          if (item) onSelectCase(item);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, onSelectCase]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--canvas)] overflow-hidden">
      {/* Action & Filter Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--glass-bg,var(--canvas))] backdrop-blur-md gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search cases... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-[12px] bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all shadow-xs"
            />
            <svg
              className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <button
              type="button"
              onClick={onTriggerSearch}
              title="Open Command Palette (⌘K)"
              className="absolute right-1.5 top-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-raised)] hover:bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              ⌘K
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority Filter */}
          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter test cases by priority"
            selectSize="sm"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          {/* Type Filter */}
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter test cases by type"
            selectSize="sm"
          >
            <option value="all">All Types</option>
            <option value="manual">Manual</option>
            <option value="automated">Automated</option>
            <option value="exploratory">Exploratory</option>
          </Select>

          {/* New Case Button */}
          <button
            type="button"
            onClick={onOpenNewCase}
            className="h-8 px-3 text-[12px] font-medium bg-[var(--accent)] text-white rounded-lg hover:brightness-105 active:scale-[0.98] transition-all duration-100 flex items-center gap-1.5 shadow-xs"
          >
            <span>+</span> New Case
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--canvas)]/50 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)] sticky top-0 z-10 backdrop-blur-sm">
              <th className="py-2 px-3 w-28">Case ID</th>
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-3 w-28">Priority</th>
              <th className="py-2 px-3 w-28">Type</th>
              <th className="py-2 px-3 w-20 text-center">Version</th>
              <th className="py-2 px-3 w-28 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/40 font-normal">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[12px] text-[var(--muted)]">
                  No test cases found. Press "+ New Case" to author the first test.
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = selectedCaseId ? selectedCaseId === item.id : selectedIndex === idx;
                const caseCode = `${projectKey}-${item.case_number}`;

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setSelectedIndex(idx);
                      onSelectCase(item);
                    }}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSelected
                        ? 'bg-[var(--canvas)] text-[var(--text)] font-medium'
                        : 'text-[var(--text)] hover:bg-[var(--canvas)]/40'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[12px] text-[var(--muted)]">
                      {caseCode}
                    </td>
                    <td className="py-2.5 px-3 truncate max-w-md">
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{item.title}</span>
                        {item.is_flaky && (
                          <StatusPill status="flaky" showIcon={false} className="py-0 px-1 text-[9px]" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] capitalize text-[var(--muted)]">
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] capitalize text-[var(--muted)]">
                        {item.type || item.type_}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-[11px] text-[var(--muted)]">
                      v{item.version}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <StatusPill status={(item.type || item.type_) === 'automated' ? 'automated' : 'pending'} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] bg-[var(--canvas)] text-[11px] text-[var(--muted)] shrink-0">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="font-mono text-[10px]">J</kbd> / <kbd className="font-mono text-[10px]">K</kbd> to navigate
          </span>
          <span>
            <kbd className="font-mono text-[10px]">↵</kbd> to inspect
          </span>
        </div>
        <span className="font-mono tabular-nums">
          {filtered.length} of {cases.length} cases
        </span>
      </div>
    </div>
  );
}
