import React, { useEffect, useState } from 'react';
import type { TestCase, TestSuite, TestRun, Project, Workspace } from '@kobean/core';
import { useTheme, CommandPalette, CommandItem } from '@kobean/ui';
import { api } from './api/client.ts';
import { SuiteTree } from './components/SuiteTree.tsx';
import { CaseGrid } from './components/CaseGrid.tsx';
import { CaseDetailPane } from './components/CaseDetailPane.tsx';
import { RunExecutionView } from './components/RunExecutionView.tsx';
import { MiniHud } from './components/MiniHud.tsx';

export function App() {
  const { theme, setTheme, availableThemes } = useTheme();

  // Navigation & State
  const [mode, setMode] = useState<'authoring' | 'execution'>('authoring');
  const [showFloatingHud, setShowFloatingHud] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);

  // Runs
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runItems, setRunItems] = useState<any[]>([]);

  // Search & Command Palette
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Global Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize data from localhost daemon
  useEffect(() => {
    async function init() {
      try {
        const health = await api.getHealth();
        if (health.status === 'ok') {
          setIsOnline(true);
        }

        // Load or create default workspace & project
        let wsList = await api.listWorkspaces();
        let ws = wsList[0];
        if (!ws) {
          ws = await api.createWorkspace('Default Workspace', 'default');
        }
        setWorkspace(ws);

        let pList = await api.listProjects(ws.id);
        let p = pList[0];
        if (!p) {
          p = await api.createProject(ws.id, 'Core Platform', 'PLAT', 'Main test repository');
        }
        setProject(p);

        // Load suites & cases
        const sList = await api.listSuites(p.id);
        setSuites(sList);

        const cList = await api.listCases(p.id);
        setCases(cList);

        const rList = await api.listRuns(p.id);
        setRuns(rList);
      } catch (e) {
        console.warn('Local daemon offline or initializing in standalone mode:', e);
        // Provide mock initial workspace for offline client preview
        const mockWs: Workspace = {
          id: 'ws-local',
          name: 'Local Workspace',
          slug: 'local',
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        const mockProj: Project = {
          id: 'proj-local',
          workspace_id: 'ws-local',
          name: 'Local Platform',
          key: 'LOC',
          description: '100% Localhost Air-Gapped Repository',
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        setWorkspace(mockWs);
        setProject(mockProj);

        const mockSuites: TestSuite[] = [
          {
            id: 'suite-auth',
            project_id: 'proj-local',
            parent_id: null,
            title: 'Authentication & Security',
            description: null,
            position: 1,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          {
            id: 'suite-billing',
            project_id: 'proj-local',
            parent_id: null,
            title: 'Checkout & Payments',
            description: null,
            position: 2,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
        ];
        setSuites(mockSuites);

        const mockCases: TestCase[] = [
          {
            id: 'case-1',
            project_id: 'proj-local',
            suite_id: 'suite-auth',
            case_number: 1,
            title: 'Verify biometric OTP verification on high-risk login',
            preconditions: 'User has 2FA enabled on mobile authenticator',
            steps_json: JSON.stringify([
              { step_number: 1, action: 'Submit valid credentials from new IP', expected: 'Prompted for 2FA challenge' },
              { step_number: 2, action: 'Enter valid 6-digit TOTP token', expected: '200 OK session token issued' },
            ]),
            priority: 'critical',
            type_: 'automated',
            automation_id: 'tests/auth.spec.ts#test-totp',
            tags_json: '["auth","security"]',
            is_flaky: false,
            is_archived: false,
            version: 1,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          {
            id: 'case-2',
            project_id: 'proj-local',
            suite_id: 'suite-billing',
            case_number: 2,
            title: 'Process Visa card charge with 3DS v2.2 challenge',
            preconditions: 'Staging merchant account active',
            steps_json: JSON.stringify([
              { step_number: 1, action: 'Provide Visa test card number', expected: 'Card brand detected as Visa' },
              { step_number: 2, action: 'Click Pay Now', expected: '3DS friction-less challenge completed' },
            ]),
            priority: 'high',
            type_: 'manual',
            automation_id: null,
            tags_json: '["billing","visa"]',
            is_flaky: false,
            is_archived: false,
            version: 2,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
        ];
        setCases(mockCases);
      }
    }

    init();
  }, []);

  const handleCreateSuite = async (title: string) => {
    if (!project) return;
    try {
      const created = await api.createSuite(project.id, title);
      setSuites((prev) => [...prev, created]);
    } catch {
      const newSuite: TestSuite = {
        id: `suite-${Date.now()}`,
        project_id: project.id,
        parent_id: null,
        title,
        description: null,
        position: suites.length + 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      setSuites((prev) => [...prev, newSuite]);
    }
  };

  const handleCreateCase = async () => {
    if (!project) return;
    const newCaseNum = cases.length + 1;
    const newCaseItem: TestCase = {
      id: `case-${Date.now()}`,
      project_id: project.id,
      suite_id: selectedSuiteId,
      case_number: newCaseNum,
      title: 'Untitled Test Case',
      preconditions: null,
      steps_json: '[]',
      priority: 'medium',
      type_: 'manual',
      automation_id: null,
      tags_json: '[]',
      is_flaky: false,
      is_archived: false,
      version: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    setCases((prev) => [...prev, newCaseItem]);
    setSelectedCase(newCaseItem);
    setIsCreatingCase(false);
  };

  const handleSaveCase = (updated: Partial<TestCase> & { steps?: any[] }) => {
    if (!selectedCase) return;

    const modified: TestCase = {
      ...selectedCase,
      ...updated,
      version: selectedCase.version + 1,
      updated_at: Date.now(),
      steps_json: updated.steps ? JSON.stringify(updated.steps) : selectedCase.steps_json,
    };

    setCases((prev) => prev.map((c) => (c.id === modified.id ? modified : c)));
    setSelectedCase(modified);
  };

  const handleStartRun = async () => {
    if (!project) return;
    const title = `Manual Run #${runs.length + 1} - ${new Date().toLocaleDateString()}`;
    const newRun: TestRun = {
      id: `run-${Date.now()}`,
      project_id: project.id,
      title,
      environment: 'local',
      source: 'manual',
      status: 'in_progress',
      idempotency_key: `run-${Date.now()}`,
      commit_sha: null,
      branch: null,
      total_count: cases.length,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      blocked_count: 0,
      created_at: Date.now(),
      completed_at: null,
    };

    const items = cases.map((c) => ({
      item: {
        id: `item-${c.id}`,
        test_run_id: newRun.id,
        test_case_id: c.id,
        case_revision_id: `rev-${c.id}-v${c.version}`,
        status: 'pending',
      },
      case_title: c.title,
      case_number: c.case_number,
      priority: c.priority,
      latest_execution: null,
    }));

    setRuns((prev) => [newRun, ...prev]);
    setActiveRun(newRun);
    setRunItems(items);
    setMode('execution');
  };

  const handleRecordStatus = (itemId: string, status: 'passed' | 'failed' | 'blocked' | 'skipped') => {
    setRunItems((prev) =>
      prev.map((i) => {
        if (i.item.id === itemId) {
          return {
            ...i,
            item: { ...i.item, status },
            latest_execution: {
              id: `exec-${Date.now()}`,
              run_item_id: itemId,
              attempt_number: 1,
              status,
              duration_ms: 120,
              executed_at: Date.now(),
            },
          };
        }
        return i;
      })
    );
  };

  // BroadcastChannel inter-window sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('kobean_hud_sync');

    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'REQUEST_ITEMS') {
        const hudItems = runItems.map((item) => ({
          id: item.item.id,
          caseId: item.item.test_case_id,
          caseNumber: item.case_number,
          title: item.case_title,
          projectKey: project?.key || 'CASE',
          status: item.item.status,
          steps: (() => {
            try {
              const matchedCase = cases.find((c) => c.id === item.item.test_case_id);
              return matchedCase ? JSON.parse(matchedCase.steps_json || '[]') : [];
            } catch {
              return [];
            }
          })(),
        }));
        channel.postMessage({ type: 'SYNC_ITEMS', items: hudItems });
      } else if (data?.type === 'STATUS_UPDATE' && data.itemId && data.status) {
        handleRecordStatus(data.itemId, data.status);
      }
    };

    return () => channel.close();
  }, [runItems, cases, project]);

  // Command palette items
  const commandItems: CommandItem[] = [
    {
      id: 'cmd-new-case',
      title: 'Create New Test Case',
      category: 'Actions',
      shortcut: 'C',
      onSelect: handleCreateCase,
    },
    {
      id: 'cmd-start-run',
      title: 'Start New Test Run',
      category: 'Actions',
      shortcut: 'R',
      onSelect: handleStartRun,
    },
    ...cases.map((c) => ({
      id: `case-${c.id}`,
      title: `${project?.key || 'CASE'}-${c.case_number}: ${c.title}`,
      category: 'Test Cases',
      onSelect: () => {
        setMode('authoring');
        setSelectedCase(c);
      },
    })),
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--canvas)] text-[var(--text)] overflow-hidden font-sans">
      {/* Top Main Navigation Bar */}
      <header className="h-12 border-b border-[var(--border)] bg-[var(--canvas)] flex items-center justify-between px-4 shrink-0 select-none z-20">
        <div className="flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-white tracking-tighter">
              K
            </div>
            <span className="font-semibold text-[13px] tracking-tight">
              KobeanTest
            </span>
            <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono tracking-wider rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]">
              {isOnline ? 'Localhost 4000' : 'Air-Gapped'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[var(--border)]" />

          {/* Project Switcher */}
          <div className="text-[12px] font-medium text-[var(--muted)]">
            <span className="text-[var(--text)]">{project?.name || 'Loading...'}</span>
          </div>

          <div className="h-4 w-[1px] bg-[var(--border)]" />

          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMode('authoring')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-100 ${
                mode === 'authoring'
                  ? 'bg-[var(--canvas)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Authoring
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeRun) handleStartRun();
                setMode('execution');
              }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-100 ${
                mode === 'execution'
                  ? 'bg-[var(--canvas)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Execution Run
            </button>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-3">
          {/* Run Action */}
          {mode === 'authoring' && (
            <button
              type="button"
              onClick={handleStartRun}
              className="px-2.5 py-1 text-[11px] font-medium bg-[var(--card)] hover:bg-[var(--border)]/20 border border-[var(--border)] text-[var(--text)] rounded transition-colors duration-100 flex items-center gap-1.5"
            >
              <span>▶</span> Run Tests
            </button>
          )}

          {/* Theme Switcher */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            aria-label="Theme selector"
            className="h-7 text-[11px] px-2 bg-[var(--card)] text-[var(--text)] border border-[var(--border)] rounded focus:outline-none"
          >
            {availableThemes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Float Mini-HUD Toggle */}
          <button
            type="button"
            onClick={() => setShowFloatingHud((prev) => !prev)}
            className={`h-7 px-2 text-[11px] font-medium border rounded flex items-center gap-1 transition-colors ${
              showFloatingHud
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--card)] hover:bg-[var(--border)]/30 text-[var(--muted)] hover:text-[var(--text)] border-[var(--border)]'
            }`}
            title="Toggle Always-on-Top Floating Mini-HUD"
          >
            <span>🪟 Float HUD</span>
          </button>

          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="h-7 px-2 text-[11px] font-mono text-[var(--muted)] hover:text-[var(--text)] bg-[var(--card)] border border-[var(--border)] rounded flex items-center gap-1.5"
          >
            <span>⌘K</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {mode === 'authoring' ? (
          <>
            <SuiteTree
              suites={suites}
              selectedSuiteId={selectedSuiteId}
              onSelectSuite={setSelectedSuiteId}
              onCreateSuite={handleCreateSuite}
              totalCasesCount={cases.length}
            />

            <CaseGrid
              cases={cases.filter((c) => !selectedSuiteId || c.suite_id === selectedSuiteId)}
              selectedCaseId={selectedCase?.id || null}
              onSelectCase={setSelectedCase}
              onOpenNewCase={handleCreateCase}
              projectKey={project?.key || 'TEST'}
              onTriggerSearch={() => setIsCommandOpen(true)}
            />

            {selectedCase && (
              <CaseDetailPane
                caseItem={selectedCase}
                onClose={() => setSelectedCase(null)}
                onSave={handleSaveCase}
                projectKey={project?.key || 'TEST'}
              />
            )}
          </>
        ) : (
          activeRun && (
            <RunExecutionView
              run={activeRun}
              items={runItems}
              onRecordStatus={handleRecordStatus}
              onBackToAuthoring={() => setMode('authoring')}
              projectKey={project?.key || 'TEST'}
            />
          )
        )}
      </div>

      {/* Raycast-Grade Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        items={commandItems}
      />

      {/* Floating Mini-HUD Runner */}
      {showFloatingHud && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <MiniHud
            items={runItems.map((item) => ({
              id: item.item.id,
              caseId: item.item.test_case_id,
              caseNumber: item.case_number,
              title: item.case_title,
              projectKey: project?.key || 'CASE',
              status: item.item.status,
              steps: (() => {
                try {
                  const matchedCase = cases.find((c) => c.id === item.item.test_case_id);
                  return matchedCase ? JSON.parse(matchedCase.steps_json || '[]') : [];
                } catch {
                  return [];
                }
              })(),
            }))}
            onRecordStatus={(itemId, status) => {
              handleRecordStatus(itemId, status);
            }}
            onClose={() => setShowFloatingHud(false)}
          />
        </div>
      )}
    </div>
  );
}
