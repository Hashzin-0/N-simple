'use client';

import React, { useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface GooeyCellDividerProps {
  mode: 'single' | 'range';
  onModeChange?: (mode: 'single' | 'range') => void;
  accentColor?: string;
  isDark?: boolean;
  children: React.ReactNode;
}

const SPRING = {
  type: 'spring' as const,
  stiffness: 130,
  damping: 24,
  mass: 1.2,
};

const SNAP_SPRING = {
  type: 'spring' as const,
  stiffness: 250,
  damping: 22,
  mass: 0.8,
};

export default function GooeyCellDivider({
  mode,
  accentColor = '#D4A373',
  isDark = false,
  children,
}: GooeyCellDividerProps) {
  const uid = useId().replace(/:/g, '');
  const filterId = `gooey-cell-${uid}`;

  const isRange = mode === 'range';

  const childrenArray = React.Children.toArray(children);
  const firstChild = childrenArray[0];
  const secondChild = childrenArray[1];

  const darkBg = isDark ? '#242720' : '#FAF9F5';
  const darkBg2 = isDark ? '#2A2D26' : '#F5F2EC';

  return (
    <div className="relative w-full" style={{ minHeight: '72px' }}>
      {/* === SVG GOO FILTER === */}
      <svg className="absolute" style={{ width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter
            id={filterId}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="18 0 0 0 0
                      0 18 0 0 0
                      0 0 18 0 0
                      0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* === BLOB SILHOUETTES (filtered — organic merge effect) === */}
      <div
        className="absolute inset-0 overflow-visible pointer-events-none"
        style={{ filter: `url(#${filterId})` }}
      >
        <div className="relative w-full h-full">
          {/* Left blob (input 2 — emerges from center when range) */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 rounded-xl"
            animate={{
              width: isRange ? '48%' : '100%',
              opacity: 1,
              x: isRange ? '0%' : '0%',
            }}
            transition={SNAP_SPRING}
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${darkBg} 0%, ${darkBg2} 100%)`
                : `linear-gradient(135deg, ${darkBg} 0%, ${darkBg2} 100%)`,
            }}
          />

          {/* Right blob (input 1 — shrinks when range) */}
          <motion.div
            className="absolute top-0 bottom-0 right-0 rounded-xl"
            animate={{
              width: isRange ? '48%' : '0%',
              opacity: isRange ? 1 : 0,
            }}
            transition={SNAP_SPRING}
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${darkBg2} 0%, ${darkBg} 100%)`
                : `linear-gradient(135deg, ${darkBg2} 0%, ${darkBg} 100%)`,
            }}
          />
        </div>
      </div>

      {/* === CARD CONTENT (NOT filtered — crisp text) === */}
      <div className="relative z-10">
        <div
          className="rounded-xl overflow-hidden border"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #2C3328 0%, #242720 100%)'
              : 'linear-gradient(135deg, #FAF9F5 0%, #F5F2EC 100%)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <AnimatePresence mode="wait">
            {!isRange ? (
              /* === SINGLE MODE: one input full width === */
              <motion.div
                key="single"
                className="relative"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              >
                {firstChild}
              </motion.div>
            ) : (
              /* === RANGE MODE: two inputs side by side === */
              <motion.div
                key="range"
                className="relative flex"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              >
                {/* Left input — emerges */}
                <motion.div
                  className="relative flex-1 min-w-0"
                  initial={{ width: '100%', x: 0 }}
                  animate={{ width: '50%', x: 0 }}
                  transition={SNAP_SPRING}
                >
                  {firstChild}
                </motion.div>

                {/* Separator */}
                <div
                  className="w-px shrink-0"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
                  }}
                />

                {/* Right input — slides in */}
                <motion.div
                  className="relative flex-1 min-w-0"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '50%', opacity: 1 }}
                  transition={{
                    width: SNAP_SPRING,
                    opacity: { duration: 0.3, delay: 0.1 },
                  }}
                >
                  {secondChild}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* === GOO NECK ACCENT GLOW (visible during transition) === */}
      <AnimatePresence>
        {isRange && (
          <motion.div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: '48%',
              width: 4,
              zIndex: 5,
              background: `linear-gradient(180deg, transparent 10%, ${accentColor}30 50%, transparent 90%)`,
              borderRadius: 2,
              filter: `blur(3px)`,
            }}
            initial={{ opacity: 0, scaleY: 0.5 }}
            animate={{ opacity: [0, 0.6, 0.3], scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.5 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
