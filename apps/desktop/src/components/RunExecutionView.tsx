import React, { useEffect, useState } from 'react';
import type { TestRun } from '@kobean/core';
import { StatusPill } from '@kobean/ui';

export interface RunExecutionViewProps {
  run: TestRun;
  items: any[];
  onRecordStatus: (itemId: string, status: 'passed' | 'failed' | 'blocked' | 'skipped') => void;
  onBackToAuthoring: () => void;
  projectKey: string;
}

export function RunExecutionView({
  run,
  items,
  onRecordStatus,
  onBackToAuthoring,
  projectKey,
}: RunExecutionViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeItem = items[selectedIndex];

  // Hotkeys: P, F, S, B, J, K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (activeItem) onRecordStatus(activeItem.item.id, 'passed');
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (activeItem) onRecordStatus(activeItem.item.id, 'failed');
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeItem) onRecordStatus(activeItem.item.id, 'skipped');
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (activeItem) onRecordStatus(activeItem.item.id, 'blocked');
      } else if (e.key.toLowerCase() === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if (e.key.toLowerCase() === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, activeItem, onRecordStatus]);

  const total = items.length || 1;
  const passedCount = items.filter((i) => i.item.status === 'passed').length;
  const failedCount = items.filter((i) => i.item.status === 'failed').length;
  const skippedCount = items.filter((i) => i.item.status === 'skipped').length;
  const blockedCount = items.filter((i) => i.item.status === 'blocked').length;

  const passedPct = Math.round((passedCount / total) * 100);
  const failedPct = Math.round((failedCount / total) * 100);

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--card)] overflow-hidden">
      {/* Run Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--canvas)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToAuthoring}
            className="px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text)] rounded border border-[var(--border)]"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
              {run.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono">
              <span>env: {run.environment}</span>
              <span>•</span>
              <span>source: {run.source}</span>
            </div>
          </div>
        </div>

        {/* Live Aggregates Bar */}
        <div className="flex items-center gap-2">
          <StatusPill status="passed" count={passedCount} />
          <StatusPill status="failed" count={failedCount} />
          {blockedCount > 0 && <StatusPill status="blocked" count={blockedCount} />}
          {skippedCount > 0 && <StatusPill status="skipped" count={skippedCount} />}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-[var(--border)] flex">
        <div style={{ width: `${passedPct}%` }} className="bg-emerald-500 transition-all duration-200" />
        <div style={{ width: `${failedPct}%` }} className="bg-rose-500 transition-all duration-200" />
      </div>

      {/* Execution Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Run Items List (Left) */}
        <div className="w-80 h-full border-r border-[var(--border)] overflow-y-auto p-2 space-y-1 bg-[var(--canvas)] shrink-0">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.item.id}
                onClick={() => setSelectedIndex(idx)}
                className={`p-2.5 rounded text-[12px] cursor-pointer transition-colors duration-100 flex items-center justify-between border ${
                  isSelected
                    ? 'bg-[var(--card)] text-[var(--text)] border-[var(--accent)] font-medium'
                    : 'text-[var(--text)] hover:bg-[var(--card)]/50 border-transparent'
                }`}
              >
                <div className="truncate mr-2">
                  <span className="font-mono text-[10px] text-[var(--muted)] block">
                    {projectKey}-{item.case_number}
                  </span>
                  <span className="truncate block">{item.case_title}</span>
                </div>
                <StatusPill status={item.item.status} showIcon={false} className="text-[10px] px-1.5 py-0" />
              </div>
            );
          })}
        </div>

        {/* Active Test Execution Runner (Right) */}
        {activeItem ? (
          <div className="flex-1 h-full overflow-y-auto p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-semibold text-[var(--accent)] tabular-nums">
                  #{projectKey}-{activeItem.case_number}
                </span>
                <StatusPill status={activeItem.item.status} />
              </div>

              <h1 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">
                {activeItem.case_title}
              </h1>

              <div className="p-4 rounded-lg bg-[var(--canvas)] border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] block">
                  Quick Hotkeys Triage
                </span>
                <p className="text-[12px] text-[var(--muted)]">
                  Use single-character keyboard shortcuts to triage tests at 120 FPS:
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'passed')}
                    className="flex-1 py-3 px-4 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-100"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-emerald-500/20 rounded">P</kbd>
                    <span>Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'failed')}
                    className="flex-1 py-3 px-4 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-100"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-rose-500/20 rounded">F</kbd>
                    <span>Fail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'blocked')}
                    className="flex-1 py-3 px-4 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-100"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-amber-500/20 rounded">B</kbd>
                    <span>Block</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'skipped')}
                    className="flex-1 py-3 px-4 rounded bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border border-slate-500/30 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-100"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-500/20 rounded">S</kbd>
                    <span>Skip</span>
                  </button>
                </div>
              </div>

              {/* Execution Notes / Failure Context */}
              {activeItem.latest_execution && (
                <div className="p-4 rounded-lg bg-[var(--canvas)] border border-[var(--border)] space-y-1">
                  <span className="text-[11px] font-medium text-[var(--muted)]">
                    Attempt #{activeItem.latest_execution.attempt_number} — Duration: {activeItem.latest_execution.duration_ms}ms
                  </span>
                  {activeItem.latest_execution.error_message && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                      {activeItem.latest_execution.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Navigator */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] text-[12px] text-[var(--muted)]">
              <span>
                <kbd className="font-mono">J</kbd> Next • <kbd className="font-mono">K</kbd> Prev
              </span>
              <span className="font-mono tabular-nums">
                {selectedIndex + 1} / {items.length}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
            Select a test case to execute
          </div>
        )}
      </div>
    </div>
  );
}
