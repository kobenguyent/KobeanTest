import React, { useEffect, useState, useRef } from 'react';
import type { TestRun } from '@kobean/core';
import { StatusPill } from '@kobean/ui';
import { api } from '../api/client.ts';
import { ImageAnnotationCanvas } from './ImageAnnotationCanvas.tsx';

export interface RunExecutionViewProps {
  run: TestRun;
  items: any[];
  onRecordStatus: (itemId: string, status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'pending') => void;
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
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, any[]>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeItem = items[selectedIndex];
  const activeExecution = activeItem?.latest_execution;

  // Fetch attachments for active execution
  useEffect(() => {
    if (!activeExecution?.id) return;
    api.listAttachments(activeExecution.id)
      .then((atts) => {
        setAttachmentsMap((prev) => ({ ...prev, [activeExecution.id]: atts }));
      })
      .catch(() => {
        // Standalone/offline mode fallback
      });
  }, [activeExecution?.id]);

  // Global Clipboard Paste (Cmd+V / Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (pendingImage) return;
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;

      for (let i = 0; i < clipItems.length; i++) {
        if (clipItems[i].type.indexOf('image') !== -1) {
          const file = clipItems[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                setPendingImage(reader.result);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pendingImage]);

  // Hotkeys: P, F, S, B, J, K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pendingImage || enlargedImage) return;

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
      } else if (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (activeItem) onRecordStatus(activeItem.item.id, 'pending');
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
  }, [items, selectedIndex, activeItem, onRecordStatus, pendingImage, enlargedImage]);

  const handleSaveAnnotatedImage = async (annotatedDataUrl: string) => {
    setPendingImage(null);

    // If no execution exists yet, create one marked as failed (defect context)
    let executionId = activeExecution?.id;
    if (!executionId && activeItem) {
      onRecordStatus(activeItem.item.id, 'failed');
      executionId = `exec-${Date.now()}`;
    }

    if (executionId) {
      try {
        const att = await api.uploadAttachment(executionId, {
          file_name: `defect-${Date.now()}.png`,
          mime_type: 'image/png',
          data_base64: annotatedDataUrl,
        });
        setAttachmentsMap((prev) => ({
          ...prev,
          [executionId]: [...(prev[executionId] || []), att],
        }));
      } catch {
        // Fallback local memory preview
        const localAtt = {
          id: `att-${Date.now()}`,
          execution_id: executionId,
          file_name: `defect-${Date.now()}.png`,
          file_path: annotatedDataUrl,
          file_size_bytes: Math.round(annotatedDataUrl.length * 0.75),
          mime_type: 'image/png',
          created_at: Date.now(),
        };
        setAttachmentsMap((prev) => ({
          ...prev,
          [executionId]: [...(prev[executionId] || []), localAtt],
        }));
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const total = items.length || 1;
  const passedCount = items.filter((i) => i.item.status === 'passed').length;
  const failedCount = items.filter((i) => i.item.status === 'failed').length;
  const skippedCount = items.filter((i) => i.item.status === 'skipped').length;
  const blockedCount = items.filter((i) => i.item.status === 'blocked').length;
  const pendingCount = items.filter((i) => i.item.status === 'pending').length;

  const passedPct = Math.round((passedCount / total) * 100);
  const failedPct = Math.round((failedCount / total) * 100);

  const activeAttachments = activeExecution ? (attachmentsMap[activeExecution.id] || []) : [];

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--card)] overflow-hidden">
      {/* Run Top Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--canvas)]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToAuthoring}
            className="px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text)] bg-[var(--card)] rounded-md border border-[var(--border)] shadow-2xs hover:shadow-xs transition-all"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
              {run.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] font-mono flex-wrap">
              <span>env: {run.environment}</span>
              <span>•</span>
              <span>source: {run.source}</span>
              {run.github_repo && (
                <>
                  <span>•</span>
                  <a
                    href={`https://github.com/${run.github_repo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--text)] hover:underline"
                    title={`Open https://github.com/${run.github_repo}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                    <span>{run.github_repo}</span>
                  </a>
                </>
              )}
              {run.branch && (
                <>
                  <span>•</span>
                  <span className="text-[var(--muted)]">branch: {run.branch}</span>
                </>
              )}
              {run.commit_sha && (
                <>
                  <span>•</span>
                  {run.github_repo ? (
                    <a
                      href={`https://github.com/${run.github_repo}/commit/${run.commit_sha}`}
                      target="_blank"
                      rel="noreferrer"
                      className="tabular-nums text-[var(--muted)] hover:text-[var(--text)] hover:underline"
                      title="View Commit on GitHub"
                    >
                      sha: {run.commit_sha.slice(0, 7)}
                    </a>
                  ) : (
                    <span className="tabular-nums">sha: {run.commit_sha.slice(0, 7)}</span>
                  )}
                </>
              )}
              {(run.pull_request_number || run.pull_request_url) && (
                <>
                  <span>•</span>
                  <a
                    href={run.pull_request_url || `https://github.com/${run.github_repo}/pull/${run.pull_request_number}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--canvas)] border border-[var(--border)] text-[var(--accent)] hover:underline tabular-nums"
                  >
                    <span>PR #{run.pull_request_number || 'View'}</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live Aggregates Bar */}
        <div className="flex items-center gap-2">
          <StatusPill status="passed" count={passedCount} />
          <StatusPill status="failed" count={failedCount} />
          {blockedCount > 0 && <StatusPill status="blocked" count={blockedCount} />}
          {skippedCount > 0 && <StatusPill status="skipped" count={skippedCount} />}
          {pendingCount > 0 && <StatusPill status="pending" count={pendingCount} />}
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
        <div className="w-80 h-full border-r border-[var(--border)] overflow-y-auto p-2.5 space-y-1.5 bg-[var(--canvas)] shrink-0">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.item.id}
                onClick={() => setSelectedIndex(idx)}
                className={`p-2.5 rounded-lg text-[12px] cursor-pointer transition-all duration-100 flex items-center justify-between border ${
                  isSelected
                    ? 'bg-[var(--card)] text-[var(--text)] border-[var(--accent)]/50 shadow-xs font-medium'
                    : 'text-[var(--text)] hover:bg-[var(--card)]/60 border-transparent'
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

              {/* Triage hotkeys banner */}
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] block">
                    Quick Hotkeys Triage
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload Screenshot"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[var(--canvas)] hover:bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--text)] flex items-center gap-1.5 shadow-2xs transition-all"
                      title="Paste image with Cmd+V or browse"
                    >
                      <span>📸 Snap / Paste</span>
                      <kbd className="text-[9px] font-mono opacity-70">⌘V</kbd>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'passed')}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-100 shadow-2xs"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-emerald-500/20 rounded">P</kbd>
                    <span>Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'failed')}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-100 shadow-2xs"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-rose-500/20 rounded">F</kbd>
                    <span>Fail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'blocked')}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/25 text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-100 shadow-2xs"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-amber-500/20 rounded">B</kbd>
                    <span>Block</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'skipped')}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 border border-slate-500/25 text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-100 shadow-2xs"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-500/20 rounded">S</kbd>
                    <span>Skip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRecordStatus(activeItem.item.id, 'pending')}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 border border-slate-500/25 text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-100 shadow-2xs"
                    title="Mark as Not Run Yet (U or N)"
                  >
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-500/20 rounded">U</kbd>
                    <span>Not Run Yet</span>
                  </button>
                </div>
              </div>

              {/* Execution Notes / Failure Context */}
              {activeExecution && (
                <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--muted)]">
                      Attempt #{activeExecution.attempt_number} — Duration: {activeExecution.duration_ms}ms
                    </span>
                    <span className="text-[10px] font-mono text-[var(--muted)]">
                      {activeAttachments.length} attachment{activeAttachments.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {activeExecution.error_message && (
                    <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                      {activeExecution.error_message}
                    </div>
                  )}

                  {/* Attachment Gallery */}
                  {activeAttachments.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)] block mb-1.5">
                        Defect Screen Clips
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {activeAttachments.map((att) => {
                          const src = att.file_path.startsWith('data:')
                            ? att.file_path
                            : api.getMediaUrl(att.file_name);
                          return (
                            <div
                              key={att.id}
                              onClick={() => setEnlargedImage(src)}
                              className="group relative border border-[var(--border)] rounded overflow-hidden cursor-pointer aspect-video bg-black/40 flex items-center justify-center"
                            >
                              <img
                                src={src}
                                alt={att.file_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                                🔍 Click to view
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Navigator */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] text-[12px] text-[var(--muted)]">
              <span>
                <kbd className="font-mono">J</kbd> Next • <kbd className="font-mono">K</kbd> Prev • Paste <kbd className="font-mono">⌘V</kbd> to attach clip
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

      {/* Screenshot Annotation Modal */}
      {pendingImage && (
        <ImageAnnotationCanvas
          imageSrc={pendingImage}
          onSave={handleSaveAnnotatedImage}
          onCancel={() => setPendingImage(null)}
        />
      )}

      {/* Enlarged Screenshot Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot Preview"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={enlargedImage}
              alt="Enlarged screenshot"
              className="max-w-full max-h-[85vh] object-contain rounded border border-[var(--border)] shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center text-[12px] font-bold shadow-md"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
