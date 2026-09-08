'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';

export type Theme = 'light' | 'dark';

const emptySubscribe = () => () => {};

let cachedTheme: Theme | null = null;
const themeListeners = new Set<() => void>();

export function applyThemeToDOM(t: Theme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }
}

function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'light';
  if (cachedTheme !== null) return cachedTheme;
  try {
    const saved = localStorage.getItem('agronomica_theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      cachedTheme = saved;
      return saved;
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    cachedTheme = prefersDark ? 'dark' : 'light';
    return cachedTheme;
  } catch {
    return 'light';
  }
}

function getThemeServerSnapshot(): Theme {
  return 'light';
}

function subscribeTheme(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  themeListeners.add(callback);

  const onStorage = (e: StorageEvent) => {
    if (e.key === 'agronomica_theme') {
      cachedTheme = null;
      callback();
    }
  };
  window.addEventListener('storage', onStorage);

  let mediaQuery: MediaQueryList | null = null;
  const onMediaChange = () => {
    try {
      if (!localStorage.getItem('agronomica_theme')) {
        cachedTheme = null;
        callback();
      }
    } catch {
      // ignore
    }
  };

  if (window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', onMediaChange);
  }

  return () => {
    themeListeners.delete(callback);
    window.removeEventListener('storage', onStorage);
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', onMediaChange);
    }
  };
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  trigger3DTransition: boolean;
  clear3DTransition: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [trigger3DTransition, setTrigger3DTransition] = useState<boolean>(false);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    cachedTheme = t;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('agronomica_theme', t);
      } catch {
        // ignore
      }
    }
    applyThemeToDOM(t);
    themeListeners.forEach((fn) => fn());
    setTrigger3DTransition(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getThemeSnapshot();
    const next: Theme = current === 'light' ? 'dark' : 'light';
    cachedTheme = next;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('agronomica_theme', next);
      } catch {
        // ignore
      }
    }
    applyThemeToDOM(next);
    themeListeners.forEach((fn) => fn());
    setTrigger3DTransition(true);
  }, []);

  const clear3DTransition = useCallback(() => {
    setTrigger3DTransition(false);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        mounted,
        toggleTheme,
        setTheme,
        trigger3DTransition,
        clear3DTransition,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

