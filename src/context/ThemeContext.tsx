import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'night' | 'morning' | 'system';
export type ResolvedTheme = 'night' | 'morning';

interface ThemeContextType {
  /** The user's explicit choice: night | morning | system */
  preference: ThemePreference;
  /** The currently-active resolved theme */
  theme: ResolvedTheme;
  /** Set the theme preference (persisted to localStorage) */
  setPreference: (pref: ThemePreference) => void;
  /** Quick toggle between night ↔ morning */
  toggle: () => void;
}

const STORAGE_KEY = 'gemini-vault:theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'morning';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'morning';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref;
}

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'night' || v === 'morning' || v === 'system') return v;
  } catch { /* localStorage unavailable */ }
  return 'morning';
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, rawSetPref] = useState<ThemePreference>(readStored);
  const [theme, setTheme] = useState<ResolvedTheme>(() => {
    const r = resolve(readStored());
    applyTheme(r);
    return r;
  });

  const setPreference = useCallback((next: ThemePreference) => {
    rawSetPref(next);
    const r = resolve(next);
    setTheme(r);
    applyTheme(r);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* best-effort */ }
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === 'night' ? 'morning' : 'night');
  }, [theme, setPreference]);

  // Listen for OS theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const r = resolve('system');
      setTheme(r);
      applyTheme(r);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
