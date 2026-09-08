'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Phase = 'idle' | 'growing' | 'sliding' | 'split' | 'merging' | 'merged';

interface CellDivisionContainerProps {
  mode: 'single' | 'range';
  onModeChange: (mode: 'single' | 'range') => void;
  accentColor?: string;
  isDark?: boolean;
  children: React.ReactNode;
}

const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  angle: (i / 10) * Math.PI * 2,
  dist: 24 + (((i * 7 + 3) % 11) / 11) * 16,
  size: 2.5 + (((i * 3 + 5) % 7) / 7) * 2.5,
}));

export default function CellDivisionContainer({
  mode,
  onModeChange,
  accentColor = '#D4A373',
  isDark = false,
  children,
}: CellDivisionContainerProps) {
  const [phase, setPhase] = useState<Phase>(mode === 'range' ? 'split' : 'idle');
  const prevMode = useRef(mode);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, delay: number) => {
    timers.current.push(setTimeout(fn, delay));
  }, []);

  useEffect(() => {
    if (mode === prevMode.current) return;
    prevMode.current = mode;
    clearTimeouts();

    if (mode === 'range') {
      addTimer(() => setPhase('growing'), 0);
      addTimer(() => setPhase('sliding'), 200);
      addTimer(() => setPhase('split'), 900);
    } else {
      addTimer(() => setPhase('merging'), 0);
      addTimer(() => setPhase('merged'), 650);
      addTimer(() => setPhase('idle'), 700);
    }

    return clearTimeouts;
  }, [mode, clearTimeouts, addTimer]);

  const isSliding = phase === 'sliding';
  const isSplit = phase === 'split';
  const isMerging = phase === 'merging';
  const isGrowing = phase === 'growing';
  const isIdle = phase === 'idle' || phase === 'merged';
  const isAnimating = isSliding || isMerging || isGrowing;

  const [snapFlash, setSnapFlash] = useState(false);

  useEffect(() => {
    if (isSliding) {
      addTimer(() => setSnapFlash(true), 580);
      addTimer(() => setSnapFlash(false), 820);
    } else {
      addTimer(() => setSnapFlash(false), 0);
    }
  }, [isSliding, addTimer]);

  const childrenArray = React.Children.toArray(children);
  const firstChild = childrenArray[0];
  const secondChild = childrenArray[1];

  const filterId = 'gooey-cell';
  const gooBg = isDark ? '#242720' : '#FAF9F5';
  const gooBorder = accentColor + '40';

  const showSecond = !isIdle;

  return (
    <div className="relative w-full" style={{ minHeight: '72px' }}>
      {/* === SVG GOO FILTER (godui.design metaball technique) === */}
      <svg aria-hidden="true" className="pointer-events-none absolute size-0">
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
            <feFlood style={{ floodColor: gooBg }} result="cardColor" />
            <feComposite in="cardColor" in2="goo" operator="in" result="fillLayer" />
            <feGaussianBlur in="goo" stdDeviation="1.1" result="edge" />
            <feColorMatrix
              in="edge"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 50 -41"
              result="eroded"
            />
            <feComposite in="goo" in2="eroded" operator="out" result="ring" />
            <feFlood style={{ floodColor: gooBorder }} result="borderColor" />
            <feComposite in="borderColor" in2="ring" operator="in" result="borderLayer" />
            <feMerge result="surface">
              <feMergeNode in="fillLayer" />
              <feMergeNode in="borderLayer" />
            </feMerge>
            <feGaussianBlur in="surface" stdDeviation="0.4" />
          </filter>
        </defs>
      </svg>

      {/* === GOO BACKGROUND LAYER (filtered — organic merge) === */}
      <div
        className="absolute inset-0 overflow-visible pointer-events-none"
        style={{ filter: `url(#${filterId})` }}
      >
        <div className="relative w-full h-full">
          {/* Left silhouette — clips from center, then slides left */}
          <motion.div
            className="absolute top-0 left-0 h-full rounded-xl"
            style={{
              width: '100%',
              background: gooBg,
            }}
            animate={{
              clipPath: isIdle
                ? 'inset(0 0% 0 0%)'
                : isGrowing
                  ? 'inset(0 50% 0 50%)'
                  : 'inset(0 0% 0 0%)',
              x: isSliding || isSplit ? '-2%' : '0%',
              scaleX: isGrowing ? 1 : isSliding ? 0.96 : 1,
            }}
            transition={{
              clipPath: {
                type: 'spring',
                stiffness: isGrowing ? 200 : 250,
                damping: isGrowing ? 22 : 24,
                mass: 0.8,
              },
              x: {
                type: 'spring',
                stiffness: 180,
                damping: 20,
                mass: 0.6,
              },
              scaleX: { duration: 0.3 },
            }}
          />

          {/* Right silhouette — emerges from center, slides right */}
          <AnimatePresence>
            {showSecond && (
              <motion.div
                className="absolute top-0 right-0 h-full rounded-xl"
                style={{
                  width: '100%',
                  background: gooBg,
                }}
                initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
                animate={{
                  opacity: 1,
                  clipPath: 'inset(0 0% 0 0%)',
                  x: isSliding || isSplit ? '2%' : '0%',
                  scaleX: isGrowing ? 1 : isSliding ? 0.96 : 1,
                }}
                exit={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
                transition={{
                  clipPath: {
                    type: 'spring',
                    stiffness: isGrowing ? 200 : 250,
                    damping: isGrowing ? 22 : 24,
                    mass: 0.8,
                  },
                  x: {
                    type: 'spring',
                    stiffness: 180,
                    damping: 20,
                    mass: 0.6,
                  },
                  opacity: { duration: 0.25 },
                  scaleX: { duration: 0.3 },
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* === SNAP FLASH EFFECT === */}
      <AnimatePresence>
        {snapFlash && (
          <>
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 pointer-events-none rounded-full"
              style={{
                width: 6,
                height: 6,
                border: `2px solid ${accentColor}`,
                zIndex: 10,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 12, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: accentColor,
                  zIndex: 11,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(p.angle) * p.dist,
                  y: Math.sin(p.angle) * p.dist,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: i * 0.015 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* === CONTENT LAYER (NOT filtered — crisp text) === */}
      <div className="relative z-10 flex gap-2">
        {/* Input 1 — always visible, slides right during split */}
        <motion.div
          className="relative overflow-hidden flex-1 min-w-0"
          style={{ zIndex: 2 }}
          animate={{
            x: isSliding || isSplit ? '2%' : '0%',
            scaleX: isGrowing ? 1.01 : isSliding ? 0.98 : 1,
          }}
          transition={{
            x: {
              type: 'spring',
              stiffness: 180,
              damping: 20,
              mass: 0.6,
            },
            scaleX: { duration: 0.3 },
          }}
        >
          {firstChild}
        </motion.div>

        {/* Input 2 — emerges from center, slides left */}
        <AnimatePresence>
          {showSecond && (
            <motion.div
              className="relative overflow-hidden flex-1 min-w-0"
              style={{ zIndex: 2 }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{
                opacity: 1,
                scaleX: isGrowing ? 0.5 : isSliding ? 1 : 1,
                x: isSliding || isSplit ? '-2%' : '0%',
              }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{
                opacity: { duration: 0.25 },
                scaleX: {
                  type: 'spring',
                  stiffness: isGrowing ? 300 : 200,
                  damping: isGrowing ? 20 : 25,
                  delay: isGrowing ? 0 : 0.1,
                },
                x: {
                  type: 'spring',
                  stiffness: 180,
                  damping: 20,
                  mass: 0.6,
                },
              }}
            >
              {secondChild}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
