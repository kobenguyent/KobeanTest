import { useState, useEffect } from 'react';
import type { TestCase, TestStep, Priority, TestType } from '@kobean/core';
import { StepEditor, Select } from '@kobean/ui';

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
  const [priority, setPriority] = useState<Priority>('medium');
  const [type_, setType] = useState<TestType>('manual');
  const [automationId, setAutomationId] = useState('');
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (caseItem) {
      setTitle(caseItem.title);
      setPreconditions(caseItem.preconditions || '');
      setPriority(caseItem.priority || 'medium');
      setType((caseItem.type || caseItem.type_ || 'manual') as TestType);
      setAutomationId(caseItem.automation_id || '');
      if (Array.isArray(caseItem.steps)) {
        setSteps(caseItem.steps);
      } else {
        try {
          setSteps(JSON.parse(caseItem.steps_json || '[]'));
        } catch {
          setSteps([]);
        }
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
      type: type_,
      type_,
      automation_id: automationId || undefined,
      steps,
    });
    setIsDirty(false);
  };

  return (
    <aside className="w-96 h-full flex flex-col bg-[var(--card)] border-l border-[var(--border)] shrink-0 select-none overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md">
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
              className="px-3 py-1 text-[11px] font-medium bg-[var(--accent)] text-white rounded-md hover:opacity-95 shadow-sm transition-opacity"
            >
              Save
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--canvas)] rounded-md transition-colors"
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
            className="w-full text-[13px] font-medium px-3 py-2 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
          />
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as Priority);
              setIsDirty(true);
            }}
            aria-label="Test case priority"
            className="w-full"
            containerClassName="w-full"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          <Select
            label="Type"
            value={type_}
            onChange={(e) => {
              setType(e.target.value as TestType);
              setIsDirty(true);
            }}
            aria-label="Test case type"
            className="w-full"
            containerClassName="w-full"
          >
            <option value="manual">Manual</option>
            <option value="automated">Automated</option>
            <option value="exploratory">Exploratory</option>
          </Select>
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
              className="w-full text-[12px] font-mono px-3 py-2 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all"
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
            className="w-full text-[12px] px-3 py-2 bg-[var(--canvas)] text-[var(--text)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] resize-none transition-all"
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
