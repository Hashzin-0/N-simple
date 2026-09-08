'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function DarkMode3DToggle() {
  const { isDark, toggleTheme, mounted } = useTheme();

  const isDarkActive = mounted ? isDark : false;

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 text-white rounded-xl border border-white/20 dark:border-white/10 transition-all duration-200 active:scale-95"
      title={isDarkActive ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={isDarkActive ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDarkActive ? (
        <Sun className="h-4 w-4 text-white" />
      ) : (
        <Moon className="h-4 w-4 text-white" />
      )}
    </button>
  );
}
