'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAnimationLock } from '@/lib/useAnimationLock';

interface CalculationIslandProps {
  isVisible: boolean;
  onToggle: () => void;
  accentColor?: string;
  darkAccentColor?: string;
  isDark?: boolean;
}

const SQUASH_CLASSES =
  'origin-bottom [will-change:transform] [-webkit-tap-highlight-color:transparent] ' +
  '[transition:scale_300ms_cubic-bezier(0.3,0.7,0.4,1.5)] ' +
  'hover:[scale:1.04] ' +
  'focus:outline-none focus-visible:outline-none ' +
  'active:[scale:var(--jelly-press)] active:[transition:scale_120ms_cubic-bezier(0.3,0.7,0.4,1)] ' +
  'data-[pressed=true]:[scale:var(--jelly-press)] data-[pressed=true]:[transition:scale_120ms_cubic-bezier(0.3,0.7,0.4,1)] ' +
  'motion-reduce:[transition:none] motion-reduce:hover:[scale:1] motion-reduce:active:[scale:1]';

export default function CalculationIsland({
  isVisible,
  onToggle,
  accentColor = '#5A5A40',
  darkAccentColor = '#9CB386',
  isDark = false,
}: CalculationIslandProps) {
  const activeColor = isDark ? darkAccentColor : accentColor;
  const { withLock } = useAnimationLock(400);

  return (
    <motion.button
      type="button"
      onClick={withLock(onToggle)}
      className={`absolute -top-1 -right-1 z-20 group cursor-pointer select-none ${SQUASH_CLASSES}`}
      style={{ '--jelly-press': '1.132 0.868' } as React.CSSProperties}
      title={isVisible ? 'Fechar memória de cálculo' : 'Ver memória de cálculo (passo a passo)'}
    >
      <div
        className="relative flex items-center justify-center w-8 h-8 rounded-bl-2xl transition-all duration-300"
        style={{
          backgroundColor: activeColor,
          boxShadow: isVisible
            ? `0 0 12px ${activeColor}88, 0 2px 8px rgba(0,0,0,0.15)`
            : `0 2px 6px rgba(0,0,0,0.12)`,
        }}
      >
        {/* SVG "C" icon — Cálculo */}
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

        {/* Active dot indicator */}
        <AnimatePresence>
          {isVisible && (
            <motion.span
              layoutId="island-dot"
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4A373] border border-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}
