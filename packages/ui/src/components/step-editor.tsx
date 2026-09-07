import React from 'react';
import type { TestStep } from '@kobean/core';

export interface StepEditorProps {
  steps: TestStep[];
  onChange: (steps: TestStep[]) => void;
  readOnly?: boolean;
}

export function StepEditor({ steps, onChange, readOnly = false }: StepEditorProps) {
  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    onChange([...steps, { step_number: nextNum, action: '', expected: '' }]);
  };

  const handleUpdateStep = (index: number, field: 'action' | 'expected', value: string) => {
    const updated = [...steps];
    const item = updated[index];
    if (item) {
      updated[index] = { ...item, [field]: value };
      onChange(updated);
    }
  };

  const handleRemoveStep = (index: number) => {
    const filtered = steps.filter((_, i) => i !== index);
    const renumbered = filtered.map((step, i) => ({
      ...step,
      step_number: i + 1,
    }));
    onChange(renumbered);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const updated = [...steps];
    const temp = updated[index];
    const target = updated[targetIndex];
    if (temp && target) {
      updated[index] = target;
      updated[targetIndex] = temp;
      const renumbered = updated.map((step, i) => ({
        ...step,
        step_number: i + 1,
      }));
      onChange(renumbered);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-[var(--border)]">
        <span className="text-[12px] font-medium tracking-tight text-[var(--text)]">
          Execution Steps
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
      </div>

      {steps.length === 0 && (
        <div className="py-6 text-center text-[12px] text-[var(--muted)] border border-dashed border-[var(--border)] rounded-md">
          No steps defined. Click below to add the first step.
        </div>
      )}

      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="group relative p-3 rounded-md bg-[var(--card)] border border-[var(--border)] transition-all duration-100 focus-within:border-[var(--accent)]"
          >
            <div className="flex items-start gap-3">
              {/* Step Number Badge */}
              <div className="flex items-center justify-center w-6 h-6 rounded bg-[var(--canvas)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--muted)] shrink-0 mt-1">
                {step.step_number}
              </div>

              {/* Action and Expected Inputs */}
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
                    Action / Instruction
                  </label>
                  <textarea
                    rows={2}
                    readOnly={readOnly}
                    className="w-full text-[13px] bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded p-2 focus:outline-none focus:border-[var(--accent)] resize-none"
                    placeholder="e.g. Enter card details and click Pay Now..."
                    value={step.action}
                    onChange={(e) => handleUpdateStep(idx, 'action', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
                    Expected Result
                  </label>
                  <textarea
                    rows={2}
                    readOnly={readOnly}
                    className="w-full text-[13px] bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded p-2 focus:outline-none focus:border-[var(--accent)] resize-none"
                    placeholder="e.g. 200 OK webhook received, receipt modal displayed..."
                    value={step.expected}
                    onChange={(e) => handleUpdateStep(idx, 'expected', e.target.value)}
                  />
                </div>
              </div>

              {/* Controls */}
              {!readOnly && (
                <div className="flex flex-col gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-100">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveStep(idx, 'up')}
                    className="p-1 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20"
                    title="Move Step Up"
                    aria-label="Move Step Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === steps.length - 1}
                    onClick={() => handleMoveStep(idx, 'down')}
                    className="p-1 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20"
                    title="Move Step Down"
                    aria-label="Move Step Down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="p-1 text-rose-500 hover:text-rose-400"
                    title="Delete Step"
                    aria-label="Delete Step"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={handleAddStep}
          className="w-full py-2 text-[12px] font-medium text-[var(--text)] bg-[var(--card)] hover:bg-[var(--canvas)] border border-[var(--border)] rounded-md transition-colors duration-100 flex items-center justify-center gap-1.5"
        >
          <span>+</span> Add Step
        </button>
      )}
    </div>
  );
}
