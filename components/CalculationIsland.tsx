'use client';

import React from 'react';

interface CalculationIslandProps {
  isVisible: boolean;
  onToggle: () => void;
  accentColor?: string;
  darkAccentColor?: string;
  isDark?: boolean;
}

export default function CalculationIsland({
  isVisible,
  onToggle,
  accentColor = '#5A5A40',
  darkAccentColor = '#9CB386',
  isDark = false,
}: CalculationIslandProps) {
  const activeColor = isDark ? darkAccentColor : accentColor;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute -top-1 -right-1 z-20 group cursor-pointer select-none transition-transform duration-150 hover:scale-110 active:scale-95"
      title={isVisible ? 'Fechar memória de cálculo' : 'Ver memória de cálculo (passo a passo)'}
    >
      <div
        className="relative flex items-center justify-center w-8 h-8 rounded-bl-2xl transition-all duration-200"
        style={{
          backgroundColor: activeColor,
          boxShadow: isVisible
            ? `0 0 12px ${activeColor}88, 0 2px 8px rgba(0,0,0,0.15)`
            : `0 2px 6px rgba(0,0,0,0.12)`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6C14.5 3 9.5 3 6 6s-3.5 8 0 11 8.5 4 12 1" />
        </svg>

        {isVisible && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4A373] border border-white" />
        )}
      </div>
    </button>
  );
}
