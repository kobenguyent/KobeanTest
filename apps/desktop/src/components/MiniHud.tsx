import { useEffect, useRef, useState } from 'react';
import type { TestStep } from '@kobean/core';

export interface MiniHudItem {
  id: string;
  caseId: string;
  caseNumber: number;
  title: string;
  projectKey: string;
  status: 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped';
  steps: TestStep[];
}

export interface MiniHudProps {
  items: MiniHudItem[];
  currentIndex?: number;
  onRecordStatus: (itemId: string, status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'pending', note?: string) => void;
  onClose?: () => void;
  onPopOut?: () => void;
  onSnapScreenshot?: (itemId: string) => void;
}

export function MiniHud({
  items,
  currentIndex: initialIndex = 0,
  onRecordStatus,
  onClose,
  onPopOut,
  onSnapScreenshot,
}: MiniHudProps) {
  const [index, setIndex] = useState(initialIndex);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      let newX = dragRef.current.initialX + dx;
      let newY = dragRef.current.initialY + dy;

      const width = containerRef.current?.offsetWidth || 360;
      const height = containerRef.current?.offsetHeight || 220;
      const maxX = window.innerWidth - width - 8;
      const maxY = window.innerHeight - height - 8;

      newX = Math.max(8, Math.min(newX, maxX));
      newY = Math.max(8, Math.min(newY, maxY));

      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const current = items[index];
  const steps = current?.steps || [];
  const currentStep = steps[currentStepIndex];

  // Sync index when initialIndex changes
  useEffect(() => {
    setIndex(initialIndex);
    setCurrentStepIndex(0);
  }, [initialIndex]);

  // Keyboard navigation & triage
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showNoteInput) {
        if (e.key === 'Escape') {
          setShowNoteInput(false);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          if (current) {
            onRecordStatus(current.id, 'failed', note);
            setShowNoteInput(false);
            setNote('');
            setIndex((prev) => Math.min(items.length - 1, prev + 1));
          }
        }
        return;
      }

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (current) {
          onRecordStatus(current.id, 'passed');
          setIndex((prev) => Math.min(items.length - 1, prev + 1));
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowNoteInput(true);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (current) {
          onRecordStatus(current.id, 'skipped');
          setIndex((prev) => Math.min(items.length - 1, prev + 1));
        }
      } else if (e.key.toLowerCase() === 'u' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (current) {
          onRecordStatus(current.id, 'pending');
          setIndex((prev) => Math.min(items.length - 1, prev + 1));
        }
      } else if (e.key === ']' || e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((prev) => Math.min(items.length - 1, prev + 1));
        setCurrentStepIndex(0);
      } else if (e.key === '[' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((prev) => Math.max(0, prev - 1));
        setCurrentStepIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, index, current, onRecordStatus, showNoteInput, note]);

  // Intercept image paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      for (let i = 0; i < clipItems.length; i++) {
        if (clipItems[i].type.indexOf('image') !== -1) {
          if (current && onSnapScreenshot) {
            onSnapScreenshot(current.id);
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [current, onSnapScreenshot]);

  // BroadcastChannel sync across multi-window
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('kobean_hud_sync');

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'NAVIGATE' && typeof data.index === 'number') {
        setIndex(data.index);
      }
    };

    return () => channel.close();
  }, []);

  if (!current) {
    return (
      <div className="w-[360px] h-[220px] bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] rounded-lg p-4 flex flex-col items-center justify-center text-[var(--muted)] text-[12px] shadow-2xl">
        <span>No test items in active run</span>
        {onClose && (
          <button type="button" onClick={onClose} className="mt-2 text-[11px] underline">
            Close HUD
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: pos ? `${pos.x}px` : undefined,
        top: pos ? `${pos.y}px` : undefined,
        right: pos ? undefined : '24px',
        bottom: pos ? undefined : '24px',
        zIndex: 9999,
      }}
      className="w-[360px] h-[220px] bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] rounded-lg p-3 flex flex-col justify-between select-none shadow-2xl text-[var(--text)] font-sans overflow-hidden"
      role="region"
      aria-label="Floating Mini-HUD"
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between pb-1.5 border-b border-[var(--border)]/60 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] font-semibold text-[var(--accent)] tabular-nums">
            #{current.projectKey}-{current.caseNumber}
          </span>
          <span className="text-[11px] font-medium truncate max-w-[150px]">
            {current.title}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-[var(--muted)] tabular-nums mr-1">
            {index + 1}/{items.length}
          </span>
          {onPopOut && (
            <button
              type="button"
              onClick={onPopOut}
              className="p-0.5 text-[var(--muted)] hover:text-[var(--text)] rounded text-[11px] leading-none"
              title="Pop out to Always-on-Top OS Window (Document PiP)"
              aria-label="Pop out HUD"
            >
              ⧉
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 text-[var(--muted)] hover:text-[var(--text)] rounded text-[10px] leading-none"
              aria-label="Close HUD"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 py-1.5 overflow-hidden flex flex-col justify-center">
        {showNoteInput ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase text-rose-400 block">
              Defect Note (Cmd+Enter to Save Failure)
            </span>
            <input
              autoFocus
              type="text"
              placeholder="What failed? (e.g. 500 internal error)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-[11px] px-2 py-1 bg-[var(--canvas)] text-[var(--text)] border border-rose-500/50 rounded focus:outline-none"
            />
          </div>
        ) : currentStep ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
              <span className="font-mono uppercase tracking-wider">
                Step {currentStep.step_number} of {steps.length}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((p) => p - 1)}
                  className="px-1 text-[9px] border border-[var(--border)] rounded disabled:opacity-20"
                >
                  ◀
                </button>
                <button
                  type="button"
                  disabled={currentStepIndex === steps.length - 1}
                  onClick={() => setCurrentStepIndex((p) => p + 1)}
                  className="px-1 text-[9px] border border-[var(--border)] rounded disabled:opacity-20"
                >
                  ▶
                </button>
              </div>
            </div>

            <p className="text-[11px] font-medium leading-tight text-[var(--text)] line-clamp-2">
              <span className="text-[var(--muted)]">Action:</span> {currentStep.action}
            </p>
            {currentStep.expected && (
              <p className="text-[10px] text-emerald-400/90 leading-tight line-clamp-1">
                <span className="text-[var(--muted)]">Expected:</span> {currentStep.expected}
              </p>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--muted)] italic text-center">
            No specific steps defined for this test case.
          </div>
        )}
      </div>

      {/* Instant Action Triage Bar */}
      <div className="flex items-center gap-1.5 pt-1.5 border-t border-[var(--border)]/60 shrink-0">
        <button
          type="button"
          onClick={() => {
            onRecordStatus(current.id, 'passed');
            setIndex((prev) => Math.min(items.length - 1, prev + 1));
          }}
          className="flex-1 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/30 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
          title="Mark Passed (P)"
        >
          <kbd className="text-[9px] font-mono opacity-80">P</kbd>
          <span>Pass</span>
        </button>

        <button
          type="button"
          onClick={() => setShowNoteInput(true)}
          className="flex-1 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
          title="Mark Failed (F)"
        >
          <kbd className="text-[9px] font-mono opacity-80">F</kbd>
          <span>Fail</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onRecordStatus(current.id, 'skipped');
            setIndex((prev) => Math.min(items.length - 1, prev + 1));
          }}
          className="px-2 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
          title="Skip (S)"
        >
          <kbd className="text-[9px] font-mono opacity-80">S</kbd>
        </button>

        <button
          type="button"
          onClick={() => {
            onRecordStatus(current.id, 'pending');
            setIndex((prev) => Math.min(items.length - 1, prev + 1));
          }}
          className="px-2 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
          title="Not Run Yet (U)"
        >
          <kbd className="text-[9px] font-mono opacity-80">U</kbd>
        </button>

        {onSnapScreenshot && (
          <button
            type="button"
            onClick={() => onSnapScreenshot(current.id)}
            className="px-2 py-1.5 bg-[var(--canvas)] hover:bg-[var(--border)]/40 text-[var(--text)] border border-[var(--border)] rounded text-[11px] flex items-center justify-center"
            title="Snap Screenshot"
            aria-label="Snap Screenshot"
          >
            📸
          </button>
        )}
      </div>
    </div>
  );
}
