'use client';

import React from 'react';

interface CalculationMemoryPanelProps {
  isVisible: boolean;
  children: React.ReactNode;
  isDark?: boolean;
}

export default function CalculationMemoryPanel({
  isVisible,
  children,
  isDark = false,
}: CalculationMemoryPanelProps) {
  return (
    <div className="w-full">
      {isVisible && (
        <div
          className="overflow-hidden origin-top"
          style={{
            animation: 'slideDown 300ms ease-out forwards',
          }}
        >
          <div
            className={`mt-3 pt-3 border-t ${
              isDark
                ? 'border-[#2C3328] bg-[#151813]'
                : 'border-[#E5E2D9] bg-[#F9F8F6]'
            } rounded-b-xl`}
          >
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke={isDark ? '#9CB386' : '#5A5A40'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6C14.5 3 9.5 3 6 6s-3.5 8 0 11 8.5 4 12 1" />
              </svg>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'
                }`}
              >
                Memória de Cálculo
              </span>
            </div>

            <div className="text-xs space-y-2">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
