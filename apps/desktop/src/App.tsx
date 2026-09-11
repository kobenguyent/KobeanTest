import { useEffect, useState } from 'react';
import type { TestCase, TestSuite, TestRun, Project, Workspace, RepoConnection, GitHubAccount } from '@kobean/core';
import {
  useTheme,
  CommandPalette,
  CommandItem,
  Select,
  SidebarToggleManager,
  DEFAULT_LAYOUT_STATE,
  LAYOUT_STORAGE_KEY,
  LAYOUT_PRESETS,
  type LayoutState,
  type LayoutPreset,
} from '@kobean/ui';
import { api } from './api/client.ts';
import { SuiteTree } from './components/SuiteTree.tsx';
import { CaseGrid } from './components/CaseGrid.tsx';
import { CaseDetailPane } from './components/CaseDetailPane.tsx';
import { RunExecutionView } from './components/RunExecutionView.tsx';
import { MiniHud } from './components/MiniHud.tsx';
import { BottomConsolePanel } from './components/BottomConsolePanel.tsx';

export function App() {
  const { theme, setTheme, availableThemes } = useTheme();

  // Navigation & State
  const [mode, setMode] = useState<'authoring' | 'execution'>('authoring');
  const [showFloatingHud, setShowFloatingHud] = useState(false);
  const [_workspace, setWorkspace] = useState<Workspace | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [connections, setConnections] = useState<RepoConnection[]>([]);
  const [githubAccount, setGithubAccount] = useState<GitHubAccount | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [bottomConsoleTab, setBottomConsoleTab] = useState<'triage' | 'daemon' | 'ingest' | 'connections'>('triage');

  // Layout Management State (persisted in localStorage)
  const [layoutState, setLayoutState] = useState<LayoutState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            showLeftSidebar: typeof parsed.showLeftSidebar === 'boolean' ? parsed.showLeftSidebar : DEFAULT_LAYOUT_STATE.showLeftSidebar,
            showBottomPanel: typeof parsed.showBottomPanel === 'boolean' ? parsed.showBottomPanel : DEFAULT_LAYOUT_STATE.showBottomPanel,
            showRightSidebar: typeof parsed.showRightSidebar === 'boolean' ? parsed.showRightSidebar : DEFAULT_LAYOUT_STATE.showRightSidebar,
          };
        }
      } catch {
        // Fallback to default
      }
    }
    return DEFAULT_LAYOUT_STATE;
  });

  // Sync layout state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutState));
    } catch {
      // Ignore in restricted environments
    }
  }, [layoutState]);

  // Layout Toggle Handlers
  const toggleLeftSidebar = () => {
    setLayoutState((prev) => ({ ...prev, showLeftSidebar: !prev.showLeftSidebar }));
  };

  const toggleBottomPanel = () => {
    setLayoutState((prev) => ({ ...prev, showBottomPanel: !prev.showBottomPanel }));
  };

  const toggleRightSidebar = () => {
    setLayoutState((prev) => {
      const next = !prev.showRightSidebar;
      if (next && !selectedCase && cases.length > 0) {
        setSelectedCase(cases[0] ?? null);
      }
      return { ...prev, showRightSidebar: next };
    });
  };

  const handleSelectPreset = (presetKey: LayoutPreset) => {
    const preset = LAYOUT_PRESETS[presetKey];
    if (preset) {
      setLayoutState(preset.state);
      if (preset.state.showRightSidebar && !selectedCase && cases.length > 0) {
        setSelectedCase(cases[0] ?? null);
      }
    }
  };

  const handleResetLayout = () => {
    setLayoutState(DEFAULT_LAYOUT_STATE);
  };

  // Runs
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runItems, setRunItems] = useState<any[]>([]);

  // Search & Command Palette
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Global Keyboard Shortcuts (Cmd+K, Cmd+B, Cmd+J, Cmd+Option+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const hasMod = e.metaKey || e.ctrlKey;

      if (hasMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      } else if (hasMod && e.altKey && e.key.toLowerCase() === 'b') {
        // Cmd+Option+B: Toggle Right Secondary Sidebar
        e.preventDefault();
        toggleRightSidebar();
      } else if (hasMod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b' && !isInput) {
        // Cmd+B: Toggle Left Primary Sidebar
        e.preventDefault();
        toggleLeftSidebar();
      } else if (hasMod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j' && !isInput) {
        // Cmd+J: Toggle Bottom Panel
        e.preventDefault();
        toggleBottomPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cases, selectedCase]);

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

        // Load connections
        const connList = await api.listConnections(p.id);
        setConnections(connList);

        // Load GitHub account if authenticated
        try {
          const ghAcc = await api.getGitHubAccount();
          setGithubAccount(ghAcc);
        } catch (err) {
          console.warn('Could not load GitHub account:', err);
        }

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

        const mockConn: RepoConnection = {
          id: 'conn-platform',
          project_id: 'proj-local',
          provider: 'github',
          name: 'Core Platform',
          repo_name: 'kobean-org/core-platform',
          repo_url: 'https://github.com/kobean-org/core-platform',
          default_branch: 'main',
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        setConnections([mockConn]);

        const mockSuites: TestSuite[] = [
          {
            id: 'suite-auth',
            project_id: 'proj-local',
            parent_id: null,
            title: 'Authentication & Security',
            description: null,
            position: 1,
            repo_connection_id: 'conn-platform',
            github_repo: 'kobean-org/core-platform',
            file_path: 'tests/e2e/auth.spec.ts',
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
            repo_connection_id: 'conn-platform',
            github_repo: 'kobean-org/core-platform',
            file_path: 'tests/e2e/checkout.spec.ts',
            created_at: Date.now(),
            updated_at: Date.now(),
          },
        ];
        setSuites(mockSuites);

        const mockSteps1 = [
          { step_number: 1, action: 'Submit valid credentials from new IP', expected: 'Prompted for 2FA challenge' },
          { step_number: 2, action: 'Enter valid 6-digit TOTP token', expected: '200 OK session token issued' },
        ];
        const mockSteps2 = [
          { step_number: 1, action: 'Provide Visa test card number', expected: 'Card brand detected as Visa' },
          { step_number: 2, action: 'Click Pay Now', expected: '3DS friction-less challenge completed' },
        ];
        const mockCases: TestCase[] = [
          {
            id: 'case-1',
            project_id: 'proj-local',
            suite_id: 'suite-auth',
            case_number: 1,
            title: 'Verify biometric OTP verification on high-risk login',
            preconditions: 'User has 2FA enabled on mobile authenticator',
            steps: mockSteps1,
            steps_json: JSON.stringify(mockSteps1),
            priority: 'critical',
            type: 'automated',
            type_: 'automated',
            automation_id: 'tests/auth.spec.ts#test-totp',
            tags: ['auth', 'security'],
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
            steps: mockSteps2,
            steps_json: JSON.stringify(mockSteps2),
            priority: 'high',
            type: 'manual',
            type_: 'manual',
            automation_id: null,
            tags: ['billing', 'visa'],
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

  const handleCreateConnection = async (input: {
    name: string;
    repo_name: string;
    repo_url: string;
    default_branch?: string;
  }) => {
    if (!project) return;
    try {
      const conn = await api.createConnection(project.id, input);
      setConnections((prev) => [...prev, conn]);
    } catch {
      const fallbackConn: RepoConnection = {
        id: `conn-${Date.now()}`,
        project_id: project.id,
        provider: 'github',
        name: input.name,
        repo_name: input.repo_name,
        repo_url: input.repo_url,
        default_branch: input.default_branch || 'main',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      setConnections((prev) => [...prev, fallbackConn]);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      await api.deleteConnection(connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    }
  };

  const handleSaveGitHubAccount = async (input: {
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    token: string;
  }) => {
    try {
      const acc = await api.saveGitHubAccount(input);
      setGithubAccount(acc);
    } catch (err) {
      console.error('Failed to save GitHub account:', err);
      throw err;
    }
  };

  const handleDeleteGitHubAccount = async () => {
    try {
      await api.deleteGitHubAccount();
      setGithubAccount(null);
    } catch (err) {
      console.error('Failed to delete GitHub account:', err);
      setGithubAccount(null);
    }
  };

  const handleCreateSuite = async (
    title: string,
    parentId?: string,
    extra?: { repo_connection_id?: string; github_repo?: string; file_path?: string }
  ) => {
    if (!project) return;
    try {
      const created = await api.createSuite(project.id, title, parentId, undefined, extra);
      setSuites((prev) => [...prev, created]);
    } catch {
      const newSuite: TestSuite = {
        id: `suite-${Date.now()}`,
        project_id: project.id,
        parent_id: parentId || null,
        title,
        description: null,
        position: suites.length + 1,
        repo_connection_id: extra?.repo_connection_id,
        github_repo: extra?.github_repo,
        file_path: extra?.file_path,
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
      steps: [],
      steps_json: '[]',
      priority: 'medium',
      type: 'manual',
      type_: 'manual',
      automation_id: null,
      tags: [],
      tags_json: '[]',
      is_flaky: false,
      is_archived: false,
      version: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    setCases((prev) => [...prev, newCaseItem]);
    setSelectedCase(newCaseItem);
  };

  const handleSaveCase = (updated: Partial<TestCase> & { steps?: any[] }) => {
    if (!selectedCase) return;

    const newSteps = updated.steps ?? selectedCase.steps ?? [];
    const modified: TestCase = {
      ...selectedCase,
      ...updated,
      steps: newSteps,
      steps_json: JSON.stringify(newSteps),
      type: updated.type || updated.type_ || selectedCase.type || 'manual',
      type_: updated.type || updated.type_ || selectedCase.type_ || 'manual',
      tags: updated.tags ?? selectedCase.tags ?? [],
      version: selectedCase.version + 1,
      updated_at: Date.now(),
    };

    setCases((prev) => prev.map((c) => (c.id === modified.id ? modified : c)));
    setSelectedCase(modified);

    // Persist to local daemon if online
    if (isOnline) {
      api.updateCase(modified.id, {
        title: modified.title,
        suite_id: modified.suite_id ?? undefined,
        preconditions: modified.preconditions ?? undefined,
        steps: modified.steps,
        priority: modified.priority,
        type: modified.type,
        automation_id: modified.automation_id ?? undefined,
        tags: modified.tags,
        is_flaky: modified.is_flaky,
        is_archived: modified.is_archived,
      }).catch((err) => {
        console.warn('Failed to persist case update to daemon:', err);
      });
    }
  };

  const handleStartRun = async () => {
    if (!project) return;
    const title = `Manual Run #${runs.length + 1} - ${new Date().toLocaleDateString()}`;
    const defaultConn = connections[0];
    const caseIds = cases.map((c) => c.id);

    try {
      const created = await api.createRun(project.id, title, caseIds, {
        environment: 'local',
        source: 'manual',
        repo_connection_id: defaultConn?.id,
        github_repo: defaultConn?.repo_name,
        branch: defaultConn?.default_branch || 'main',
      });
      const details = await api.getRunDetails(created.id);
      setActiveRun(details.run);
      setRunItems(details.items);
      setRuns((prev) => [details.run, ...prev]);
      setMode('execution');
    } catch {
      const newRun: TestRun = {
        id: `run-${Date.now()}`,
        project_id: project.id,
        title,
        environment: 'local',
        source: 'manual',
        status: 'in_progress',
        idempotency_key: `run-${Date.now()}`,
        commit_sha: null,
        branch: defaultConn?.default_branch || null,
        repo_connection_id: defaultConn?.id,
        github_repo: defaultConn?.repo_name,
        pull_request_number: undefined,
        pull_request_url: undefined,
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
    }
  };

  const handleRecordStatus = (itemId: string, status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'pending') => {
    setRunItems((prev) =>
      prev.map((i) => {
        if (i.item.id === itemId) {
          return {
            ...i,
            item: { ...i.item, status },
            latest_execution: status === 'pending' ? undefined : {
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
              if (!matchedCase) return [];
              return matchedCase.steps && matchedCase.steps.length > 0
                ? matchedCase.steps
                : JSON.parse(matchedCase.steps_json || '[]');
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
    {
      id: 'cmd-toggle-left-sidebar',
      title: 'Toggle Primary Side Bar (Suites Tree)',
      category: 'View',
      shortcut: '⌘B',
      onSelect: toggleLeftSidebar,
    },
    {
      id: 'cmd-toggle-bottom-panel',
      title: 'Toggle Bottom Panel (Console & Triage)',
      category: 'View',
      shortcut: '⌘J',
      onSelect: toggleBottomPanel,
    },
    {
      id: 'cmd-toggle-right-sidebar',
      title: 'Toggle Secondary Side Bar (Case Inspector)',
      category: 'View',
      shortcut: '⌥⌘B',
      onSelect: toggleRightSidebar,
    },
    {
      id: 'cmd-preset-default',
      title: 'Layout: Default (3-Pane View)',
      category: 'View',
      onSelect: () => handleSelectPreset('default'),
    },
    {
      id: 'cmd-preset-zen',
      title: 'Layout: Focus Mode (Zen)',
      category: 'View',
      onSelect: () => handleSelectPreset('zen'),
    },
    {
      id: 'cmd-preset-triage',
      title: 'Layout: Console & Triage',
      category: 'View',
      onSelect: () => handleSelectPreset('triage'),
    },
    {
      id: 'cmd-github-connections',
      title: 'GitHub Connections (Repositories)',
      category: 'Navigation',
      onSelect: () => {
        setBottomConsoleTab('connections');
        if (!layoutState.showBottomPanel) {
          setLayoutState((prev) => ({ ...prev, showBottomPanel: true }));
        }
      },
    },
    ...cases.map((c) => ({
      id: `case-${c.id}`,
      title: `${project?.key || 'CASE'}-${c.case_number}: ${c.title}`,
      category: 'Test Cases',
      onSelect: () => {
        setMode('authoring');
        setSelectedCase(c);
        if (!layoutState.showRightSidebar) {
          setLayoutState((prev) => ({ ...prev, showRightSidebar: true }));
        }
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
        <div className="flex items-center gap-2.5">
          {/* GitHub Repositories Button */}
          <button
            type="button"
            onClick={() => {
              setBottomConsoleTab('connections');
              setLayoutState((prev) => ({ ...prev, showBottomPanel: true }));
            }}
            className="px-2.5 py-1 text-[11px] font-medium bg-[var(--card)] hover:bg-[var(--border)]/20 border border-[var(--border)] text-[var(--text)] rounded transition-colors duration-100 flex items-center gap-1.5"
            title="Manage GitHub Repository Connections"
          >
            {githubAccount?.avatar_url ? (
              <img
                src={githubAccount.avatar_url}
                alt={githubAccount.login}
                className="w-3.5 h-3.5 rounded-full object-cover"
              />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            )}
            <span>{githubAccount ? `@${githubAccount.login}` : 'GitHub'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[var(--canvas)] border border-[var(--border)] font-mono font-semibold">
              {connections.length}
            </span>
          </button>

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
          <Select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            aria-label="Theme selector"
            selectSize="sm"
          >
            {availableThemes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

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

          <div className="h-4 w-[1px] bg-[var(--border)]" />

          {/* Sidebar & Layout Toggle Manager */}
          <SidebarToggleManager
            showLeftSidebar={layoutState.showLeftSidebar}
            onToggleLeftSidebar={toggleLeftSidebar}
            showBottomPanel={layoutState.showBottomPanel}
            onToggleBottomPanel={toggleBottomPanel}
            showRightSidebar={layoutState.showRightSidebar}
            onToggleRightSidebar={toggleRightSidebar}
            onResetLayout={handleResetLayout}
            onSelectPreset={handleSelectPreset}
          />
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {mode === 'authoring' ? (
            <>
              {layoutState.showLeftSidebar && (
                <SuiteTree
                  suites={suites}
                  selectedSuiteId={selectedSuiteId}
                  onSelectSuite={setSelectedSuiteId}
                  onCreateSuite={handleCreateSuite}
                  totalCasesCount={cases.length}
                  connections={connections}
                />
              )}

              <CaseGrid
                cases={cases.filter((c) => !selectedSuiteId || c.suite_id === selectedSuiteId)}
                selectedCaseId={selectedCase?.id || null}
                onSelectCase={(c) => {
                  setSelectedCase(c);
                  if (!layoutState.showRightSidebar) {
                    setLayoutState((prev) => ({ ...prev, showRightSidebar: true }));
                  }
                }}
                onOpenNewCase={handleCreateCase}
                projectKey={project?.key || 'TEST'}
                onTriggerSearch={() => setIsCommandOpen(true)}
              />

              {layoutState.showRightSidebar && selectedCase && (
                <CaseDetailPane
                  caseItem={selectedCase}
                  onClose={() => {
                    setSelectedCase(null);
                    setLayoutState((prev) => ({ ...prev, showRightSidebar: false }));
                  }}
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

        {/* Collapsible Bottom Console Panel */}
        <BottomConsolePanel
          isOpen={layoutState.showBottomPanel}
          onClose={toggleBottomPanel}
          isOnline={isOnline}
          activeRun={activeRun}
          runItems={runItems}
          onStartRun={handleStartRun}
          onSelectExecutionView={() => setMode('execution')}
          casesCount={cases.length}
          connections={connections}
          githubAccount={githubAccount}
          activeTab={bottomConsoleTab}
          onTabChange={setBottomConsoleTab}
          onCreateConnection={handleCreateConnection}
          onDeleteConnection={handleDeleteConnection}
          onSaveGitHubAccount={handleSaveGitHubAccount}
          onDeleteGitHubAccount={handleDeleteGitHubAccount}
        />
      </div>

      {/* Raycast-Grade Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        items={commandItems}
      />

      {/* Floating Mini-HUD Runner */}
      {showFloatingHud && (
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
                if (!matchedCase) return [];
                return matchedCase.steps && matchedCase.steps.length > 0
                  ? matchedCase.steps
                  : JSON.parse(matchedCase.steps_json || '[]');
              } catch {
                return [];
              }
            })(),
          }))}
          onRecordStatus={(itemId, status) => {
            handleRecordStatus(itemId, status);
          }}
          onClose={() => setShowFloatingHud(false)}
          onPopOut={async () => {
            if (typeof window !== 'undefined' && 'documentPictureInPicture' in (window as any)) {
              try {
                const pip = await (window as any).documentPictureInPicture.requestWindow({
                  width: 380,
                  height: 250,
                });
                document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
                  pip.document.head.appendChild(node.cloneNode(true));
                });
                pip.document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'warm_sand');
                setShowFloatingHud(false);
              } catch (e) {
                console.warn('PiP failed:', e);
              }
            }
          }}
        />
      )}
    </div>
  );
}
