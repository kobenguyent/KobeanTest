import React, { useState, useEffect } from 'react';
import type { TestCase, TestStep } from '@kobean/core';
import { StepEditor } from '@kobean/ui';

export interface CaseDetailPaneProps {
  caseItem: TestCase | null;
  onClose: () => void;
  onSave: (updated: Partial<TestCase> & { steps?: TestStep[] }) => void;
  projectKey: string;
}

export function CaseDetailPane({
  caseItem,
  onClose,
  onSave,
  projectKey,
}: CaseDetailPaneProps) {
  const [title, setTitle] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [priority, setPriority] = useState('medium');
  const [type_, setType] = useState('manual');
  const [automationId, setAutomationId] = useState('');
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (caseItem) {
      setTitle(caseItem.title);
      setPreconditions(caseItem.preconditions || '');
      setPriority(caseItem.priority);
      setType(caseItem.type_);
      setAutomationId(caseItem.automation_id || '');
      try {
        setSteps(JSON.parse(caseItem.steps_json || '[]'));
      } catch {
        setSteps([]);
      }
      setIsDirty(false);
    }
  }, [caseItem]);

  if (!caseItem) return null;

  const handleSave = () => {
    onSave({
      title,
      preconditions,
      priority,
      type_,
      automation_id: automationId || undefined,
      steps,
    });
    setIsDirty(false);
  };

  return (
    <aside className="w-96 h-full flex flex-col bg-[var(--canvas)] border-l border-[var(--border)] shrink-0 select-none overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] font-semibold text-[var(--accent)] tabular-nums">
            #{projectKey}-{caseItem.case_number}
          </span>
          <span className="font-mono text-[11px] text-[var(--muted)]">
            v{caseItem.version}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 text-[11px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded"
            title="Close Panel"
            aria-label="Close Panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
            Test Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsDirty(true);
            }}
            className="w-full text-[14px] font-medium px-2.5 py-1.5 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setIsDirty(true);
              }}
              aria-label="Test case priority"
              className="w-full text-[12px] px-2 py-1 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
              Type
            </label>
            <select
              value={type_}
              onChange={(e) => {
                setType(e.target.value);
                setIsDirty(true);
              }}
              aria-label="Test case type"
              className="w-full text-[12px] px-2 py-1 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none"
            >
              <option value="manual">Manual</option>
              <option value="automated">Automated</option>
              <option value="exploratory">Exploratory</option>
            </select>
          </div>
        </div>

        {/* Automation ID */}
        {type_ === 'automated' && (
          <div>
            <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
              Automation ID
            </label>
            <input
              type="text"
              placeholder="e.g. tests/auth.spec.ts#login"
              value={automationId}
              onChange={(e) => {
                setAutomationId(e.target.value);
                setIsDirty(true);
              }}
              className="w-full text-[12px] font-mono px-2.5 py-1.5 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none"
            />
          </div>
        )}

        {/* Preconditions */}
        <div>
          <label className="block text-[10px] uppercase font-medium tracking-wide text-[var(--muted)] mb-1">
            Preconditions
          </label>
          <textarea
            rows={2}
            value={preconditions}
            onChange={(e) => {
              setPreconditions(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Prerequisites required before execution..."
            className="w-full text-[12px] px-2.5 py-1.5 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none resize-none"
          />
        </div>

        {/* Step Editor */}
        <StepEditor
          steps={steps}
          onChange={(newSteps) => {
            setSteps(newSteps);
            setIsDirty(true);
          }}
        />
      </div>
    </aside>
  );
}
