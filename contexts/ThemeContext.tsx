'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  // Load theme from localStorage on mount; update html[data-theme]
  useEffect(() => {
    try {
      const savedTheme = (typeof window !== 'undefined'
        ? (localStorage.getItem('theme') as Theme | null)
        : null);

      const initial = savedTheme || 'dark';
      setThemeState(initial);
      document.documentElement.setAttribute('data-theme', initial);
      console.debug('ThemeProvider: initialized', { initial, savedTheme });
    } catch (e) {
      // Fallback to dark if localStorage not accessible
      document.documentElement.setAttribute('data-theme', 'dark');
      console.warn('ThemeProvider: localStorage access failed, defaulting to dark', e);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      console.warn('ThemeProvider: failed to persist theme', e);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
    console.debug('ThemeProvider: setTheme', { newTheme });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    console.debug('ThemeProvider: toggleTheme', { from: theme, to: newTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}