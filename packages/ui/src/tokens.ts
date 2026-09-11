export type ThemeId = 'obsidian' | 'clean_paper' | 'nordic_slate' | 'warm_sand';

export interface ThemeColors {
  canvas: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  type: 'dark' | 'light';
  colors: ThemeColors;
  contrastRatio: {
    bodyOnCard: number;
    mutedOnCard: number;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  warm_sand: {
    id: 'warm_sand',
    name: 'White Cream (Apple)',
    type: 'light',
    colors: {
      canvas: '#faf8f5',
      card: '#ffffff',
      border: 'rgba(60, 60, 67, 0.10)',
      text: '#1c1917',
      muted: '#57534e', // Verified 7.52:1 on #ffffff card (Passes AAA >= 7.0:1)
      accent: '#0071e3', // Apple Cupertino Blue
    },
    contrastRatio: {
      bodyOnCard: 17.5,
      mutedOnCard: 7.52,
    },
  },
  clean_paper: {
    id: 'clean_paper',
    name: 'Clean Paper',
    type: 'light',
    colors: {
      canvas: '#ffffff',
      card: '#f8fafc',
      border: 'rgba(0, 0, 0, 0.08)',
      text: '#0f172a',
      muted: '#334155', // Verified 9.61:1 on card (Passes AAA)
      accent: '#4f46e5',
    },
    contrastRatio: {
      bodyOnCard: 16.2,
      mutedOnCard: 9.61,
    },
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Dark',
    type: 'dark',
    colors: {
      canvas: '#09090b',
      card: '#121215',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#fafafa',
      muted: '#a1a1aa',
      accent: '#6366f1',
    },
    contrastRatio: {
      bodyOnCard: 16.5,
      mutedOnCard: 7.3, // Passes AAA (>= 7.0:1)
    },
  },
  nordic_slate: {
    id: 'nordic_slate',
    name: 'Nordic Slate',
    type: 'dark',
    colors: {
      canvas: '#0f172a',
      card: '#1e293b',
      border: 'rgba(255, 255, 255, 0.10)',
      text: '#f8fafc',
      muted: '#cbd5e1', // Verified 7.82:1 on card (Passes AAA)
      accent: '#38bdf8',
    },
    contrastRatio: {
      bodyOnCard: 13.8,
      mutedOnCard: 7.82,
    },
  },
};

export interface StatusStyle {
  label: string;
  bg: string;
  text: string;
  border: string;
  colorHex: string;
  iconName: string;
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  passed: {
    label: 'Passed',
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#10b981',
    border: 'rgba(16, 185, 129, 0.25)',
    colorHex: '#10b981',
    iconName: 'CheckCircle2',
  },
  failed: {
    label: 'Failed',
    bg: 'rgba(244, 63, 94, 0.12)',
    text: '#f43f5e',
    border: 'rgba(244, 63, 94, 0.25)',
    colorHex: '#f43f5e',
    iconName: 'AlertCircle',
  },
  blocked: {
    label: 'Blocked',
    bg: 'rgba(245, 158, 11, 0.12)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.25)',
    colorHex: '#f59e0b',
    iconName: 'Ban',
  },
  skipped: {
    label: 'Skipped',
    bg: 'rgba(100, 116, 139, 0.12)',
    text: '#64748b',
    border: 'rgba(100, 116, 139, 0.25)',
    colorHex: '#64748b',
    iconName: 'MinusCircle',
  },
  pending: {
    label: 'Not Run Yet',
    bg: 'rgba(148, 163, 184, 0.10)',
    text: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.20)',
    colorHex: '#94a3b8',
    iconName: 'Clock',
  },
  flaky: {
    label: 'Flaky',
    bg: 'rgba(168, 85, 247, 0.12)',
    text: '#a855f7',
    border: 'rgba(168, 85, 247, 0.25)',
    colorHex: '#a855f7',
    iconName: 'Flame',
  },
  automated: {
    label: 'Automated',
    bg: 'rgba(6, 182, 212, 0.12)',
    text: '#06b6d4',
    border: 'rgba(6, 182, 212, 0.25)',
    colorHex: '#06b6d4',
    iconName: 'Code2',
  },
};
