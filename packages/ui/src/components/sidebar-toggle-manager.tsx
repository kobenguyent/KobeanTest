import { useState, useRef, useEffect } from 'react';
import {
  type LayoutPreset,
  getLayoutShortcutLabels,
} from '../layout-state.js';

export interface SidebarToggleManagerProps {
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  showBottomPanel: boolean;
  onToggleBottomPanel: () => void;
  showRightSidebar: boolean;
  onToggleRightSidebar: () => void;
  onResetLayout?: () => void;
  onSelectPreset?: (preset: LayoutPreset) => void;
  className?: string;
  isMac?: boolean;
}

// 1. Customize Layout Icon [| :]
export function LayoutMenuIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2.5"
        width="3.5"
        height="11"
        rx="1"
        strokeWidth="1.25"
      />
      <rect
        x="7.5"
        y="2.5"
        width="6.5"
        height="4.5"
        rx="1"
        strokeWidth="1.25"
      />
      <rect
        x="7.5"
        y="9"
        width="6.5"
        height="4.5"
        rx="1"
        strokeWidth="1.25"
      />
    </svg>
  );
}

// 2. Toggle Primary Sidebar Icon [| ]
export function SidebarLeftIcon({
  active = false,
  className = 'w-4 h-4',
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        strokeWidth="1.25"
      />
      <line
        x1="6.5"
        y1="2.5"
        x2="6.5"
        y2="13.5"
        strokeWidth="1.25"
      />
      {active && (
        <path
          d="M 3.5 2.5 H 6.5 V 13.5 H 3.5 A 1.5 1.5 0 0 1 2 12 V 4 A 1.5 1.5 0 0 1 3.5 2.5 Z"
          fill="currentColor"
          stroke="none"
          className="opacity-90"
        />
      )}
    </svg>
  );
}

// 3. Toggle Bottom Panel Icon [—]
export function PanelBottomIcon({
  active = false,
  className = 'w-4 h-4',
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        strokeWidth="1.25"
      />
      <line
        x1="2"
        y1="9"
        x2="14"
        y2="9"
        strokeWidth="1.25"
      />
      {active && (
        <path
          d="M 2 9 H 14 V 12 A 1.5 1.5 0 0 1 12.5 13.5 H 3.5 A 1.5 1.5 0 0 1 2 12 Z"
          fill="currentColor"
          stroke="none"
          className="opacity-90"
        />
      )}
    </svg>
  );
}

// 4. Toggle Secondary Sidebar Icon [ |]
export function SidebarRightIcon({
  active = false,
  className = 'w-4 h-4',
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        strokeWidth="1.25"
      />
      <line
        x1="9.5"
        y1="2.5"
        x2="9.5"
        y2="13.5"
        strokeWidth="1.25"
      />
      {active && (
        <path
          d="M 9.5 2.5 H 12.5 A 1.5 1.5 0 0 1 14 4 V 12 A 1.5 1.5 0 0 1 12.5 13.5 H 9.5 Z"
          fill="currentColor"
          stroke="none"
          className="opacity-90"
        />
      )}
    </svg>
  );
}

export function SidebarToggleManager({
  showLeftSidebar,
  onToggleLeftSidebar,
  showBottomPanel,
  onToggleBottomPanel,
  showRightSidebar,
  onToggleRightSidebar,
  onResetLayout,
  onSelectPreset,
  className = '',
  isMac = true,
}: SidebarToggleManagerProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close layout menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const shortcuts = getLayoutShortcutLabels(isMac);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--card)]/80 border border-[var(--border)]/60 text-[var(--muted)] select-none ${className}`}
      data-testid="sidebar-toggle-manager"
    >
      {/* 1. Customize Layout Button */}
      <button
        type="button"
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label="Customize Layout"
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        title="Customize Layout"
        className={`relative w-7 h-7 flex items-center justify-center rounded transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
          isMenuOpen
            ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
            : 'hover:text-[var(--text)] hover:bg-[var(--border)]/30'
        }`}
      >
        <LayoutMenuIcon className="w-3.5 h-3.5" />
      </button>

      {/* 2. Toggle Primary Side Bar (Left) */}
      <button
        type="button"
        onClick={onToggleLeftSidebar}
        aria-label={`Toggle Primary Side Bar (${shortcuts.leftSidebar})`}
        aria-pressed={showLeftSidebar}
        title={`Toggle Primary Side Bar (${shortcuts.leftSidebar})`}
        className={`relative w-7 h-7 flex items-center justify-center rounded transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
          showLeftSidebar
            ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
            : 'hover:text-[var(--text)] hover:bg-[var(--border)]/30'
        }`}
      >
        <SidebarLeftIcon active={showLeftSidebar} className="w-3.5 h-3.5" />
      </button>

      {/* 3. Toggle Panel (Bottom) */}
      <button
        type="button"
        onClick={onToggleBottomPanel}
        aria-label={`Toggle Bottom Panel (${shortcuts.bottomPanel})`}
        aria-pressed={showBottomPanel}
        title={`Toggle Bottom Panel (${shortcuts.bottomPanel})`}
        className={`relative w-7 h-7 flex items-center justify-center rounded transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
          showBottomPanel
            ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
            : 'hover:text-[var(--text)] hover:bg-[var(--border)]/30'
        }`}
      >
        <PanelBottomIcon active={showBottomPanel} className="w-3.5 h-3.5" />
      </button>

      {/* 4. Toggle Secondary Side Bar (Right) */}
      <button
        type="button"
        onClick={onToggleRightSidebar}
        aria-label={`Toggle Secondary Side Bar (${shortcuts.rightSidebar})`}
        aria-pressed={showRightSidebar}
        title={`Toggle Secondary Side Bar (${shortcuts.rightSidebar})`}
        className={`relative w-7 h-7 flex items-center justify-center rounded transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
          showRightSidebar
            ? 'bg-[var(--canvas)] text-[var(--text)] shadow-xs border border-[var(--border)]/70'
            : 'hover:text-[var(--text)] hover:bg-[var(--border)]/30'
        }`}
      >
        <SidebarRightIcon active={showRightSidebar} className="w-3.5 h-3.5" />
      </button>

      {/* Customize Layout Dropdown Popover */}
      {isMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-56 rounded-md bg-[var(--canvas)] border border-[var(--border)] shadow-md z-50 p-1.5 text-[12px] animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Layout Panels
          </div>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showLeftSidebar}
            onClick={() => {
              onToggleLeftSidebar();
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <div className="flex items-center gap-2">
              <span className={`w-3.5 text-center text-[11px] ${showLeftSidebar ? 'text-[var(--accent)] font-bold' : 'opacity-0'}`}>
                ✓
              </span>
              <span>Primary Side Bar</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted)]">{shortcuts.leftSidebar}</span>
          </button>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showBottomPanel}
            onClick={() => {
              onToggleBottomPanel();
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <div className="flex items-center gap-2">
              <span className={`w-3.5 text-center text-[11px] ${showBottomPanel ? 'text-[var(--accent)] font-bold' : 'opacity-0'}`}>
                ✓
              </span>
              <span>Bottom Panel</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted)]">{shortcuts.bottomPanel}</span>
          </button>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showRightSidebar}
            onClick={() => {
              onToggleRightSidebar();
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <div className="flex items-center gap-2">
              <span className={`w-3.5 text-center text-[11px] ${showRightSidebar ? 'text-[var(--accent)] font-bold' : 'opacity-0'}`}>
                ✓
              </span>
              <span>Secondary Side Bar</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted)]">{shortcuts.rightSidebar}</span>
          </button>

          <div className="h-[1px] bg-[var(--border)] my-1" />

          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Layout Presets
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onSelectPreset) {
                onSelectPreset('default');
              } else {
                if (!showLeftSidebar) onToggleLeftSidebar();
                if (showBottomPanel) onToggleBottomPanel();
                if (!showRightSidebar) onToggleRightSidebar();
              }
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <span>Default (3-Pane)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onSelectPreset) {
                onSelectPreset('zen');
              } else {
                if (showLeftSidebar) onToggleLeftSidebar();
                if (showBottomPanel) onToggleBottomPanel();
                if (showRightSidebar) onToggleRightSidebar();
              }
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <span>Focus Mode (Zen)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              if (onSelectPreset) {
                onSelectPreset('triage');
              } else {
                if (!showLeftSidebar) onToggleLeftSidebar();
                if (!showBottomPanel) onToggleBottomPanel();
                if (!showRightSidebar) onToggleRightSidebar();
              }
              setIsMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
          >
            <span>Console & Triage</span>
          </button>

          {onResetLayout && (
            <>
              <div className="h-[1px] bg-[var(--border)] my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onResetLayout();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors duration-75"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset Layout</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
