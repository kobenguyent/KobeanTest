export interface LayoutState {
  showLeftSidebar: boolean;
  showBottomPanel: boolean;
  showRightSidebar: boolean;
}

export type LayoutPreset = 'default' | 'zen' | 'triage' | 'bottom-focus';

export const LAYOUT_STORAGE_KEY = 'kobean_layout_state';

export const DEFAULT_LAYOUT_STATE: LayoutState = {
  showLeftSidebar: true,
  showBottomPanel: false,
  showRightSidebar: true,
};

export const LAYOUT_PRESETS: Record<LayoutPreset, { label: string; description: string; state: LayoutState }> = {
  default: {
    label: 'Default (3-Pane)',
    description: 'Suites tree, case grid, and detail inspector',
    state: {
      showLeftSidebar: true,
      showBottomPanel: false,
      showRightSidebar: true,
    },
  },
  zen: {
    label: 'Focus Mode (Zen)',
    description: 'Maximized test grid without sidebars or bottom panel',
    state: {
      showLeftSidebar: false,
      showBottomPanel: false,
      showRightSidebar: false,
    },
  },
  triage: {
    label: 'Console & Triage',
    description: 'All panels open for active triage and system monitoring',
    state: {
      showLeftSidebar: true,
      showBottomPanel: true,
      showRightSidebar: true,
    },
  },
  'bottom-focus': {
    label: 'Runner & Console Focus',
    description: 'Bottom console open with sidebars hidden',
    state: {
      showLeftSidebar: false,
      showBottomPanel: true,
      showRightSidebar: false,
    },
  },
};

export function getLayoutShortcutLabels(isMac: boolean = true) {
  const mod = isMac ? '⌘' : 'Ctrl+';
  const alt = isMac ? '⌥' : 'Alt+';

  return {
    leftSidebar: `${mod}B`,
    bottomPanel: `${mod}J`,
    rightSidebar: `${alt}${mod}B`,
    commandPalette: `${mod}K`,
  };
}

export function getPanelAriaLabel(
  panel: 'left' | 'bottom' | 'right',
  _isOpen: boolean,
  isMac: boolean = true
): string {
  const shortcuts = getLayoutShortcutLabels(isMac);
  switch (panel) {
    case 'left':
      return `Toggle Primary Side Bar (${shortcuts.leftSidebar})`;
    case 'bottom':
      return `Toggle Bottom Panel (${shortcuts.bottomPanel})`;
    case 'right':
      return `Toggle Secondary Side Bar (${shortcuts.rightSidebar})`;
  }
}
