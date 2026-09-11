import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEMES, ThemeDefinition, ThemeId } from './tokens.js';

interface ThemeContextValue {
  theme: ThemeId;
  themeDef: ThemeDefinition;
  setTheme: (theme: ThemeId) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = 'kobean_theme';

export function ThemeProvider({
  children,
  defaultTheme = 'warm_sand',
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeId;
}) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (stored && THEMES[stored]) {
        return stored;
      }
    }
    return defaultTheme;
  });

  const themeDef = THEMES[theme] || THEMES.warm_sand;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-type', themeDef.type);

    // Apply CSS custom properties
    root.style.setProperty('--canvas', themeDef.colors.canvas);
    root.style.setProperty('--card', themeDef.colors.card);
    root.style.setProperty('--border', themeDef.colors.border);
    root.style.setProperty('--text', themeDef.colors.text);
    root.style.setProperty('--muted', themeDef.colors.muted);
    root.style.setProperty('--accent', themeDef.colors.accent);

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeDef]);

  const setTheme = (newTheme: ThemeId) => {
    if (THEMES[newTheme]) {
      setThemeState(newTheme);
    }
  };

  const value: ThemeContextValue = {
    theme,
    themeDef,
    setTheme,
    availableThemes: Object.values(THEMES),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
