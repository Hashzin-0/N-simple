'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from './ThemeProvider';
import SideRays from './SideRays';

interface LoadingSkeleton3DProps {
  onComplete: () => void;
  duration?: number;
}

type Phase = 'loading' | 'done';

export default function LoadingSkeleton3D({
  onComplete,
  duration = 4000,
}: LoadingSkeleton3DProps) {
  const { isDark } = useTheme();
  const animRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);

      if (t >= 1) {
        setPhase('done');
        onComplete();
        return;
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [duration, onComplete]);

  const handleSkip = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setPhase('done');
    setProgress(1);
    onComplete();
  }, [onComplete]);

  const phaseText = progress < 0.6 ? 'Carregando...' : 'Preparando...';

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ background: isDark ? '#0a0f08' : '#f5f3ed' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Skeleton background */}
          <div className="absolute inset-0 z-0" style={{ background: isDark ? '#0a0f08' : '#f5f3ed' }} />

          {/* SideRays overlay on top */}
          <div className="absolute inset-0 pointer-events-none z-1">
            <SideRays
              speed={1.5}
              rayColor1={isDark ? '#4a6a3a' : '#D4A373'}
              rayColor2={isDark ? '#9cb386' : '#96c8ff'}
              intensity={1.2}
              spread={1.5}
              origin="top-right"
              tilt={0}
              saturation={1.0}
              blend={0.6}
              falloff={1.8}
              opacity={0.4}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 pb-12 px-4 z-10">
            <div className="w-full max-w-xs flex flex-col items-center gap-3">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? '#1a2a10' : '#e5e2d9' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${isDark ? '#5a7a40' : '#5a5a40'}, ${isDark ? '#9cb386' : '#d4a373'})`,
                    width: `${progress * 100}%`,
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p
                className="text-xs font-medium tracking-wider uppercase"
                style={{ color: isDark ? '#9cb386' : '#5a5a40' }}
              >
                {phaseText}
              </p>
            </div>

            <button
              onClick={handleSkip}
              className="px-6 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 border"
              style={{
                background: isDark ? 'rgba(26,42,16,0.6)' : 'rgba(245,243,237,0.6)',
                color: isDark ? '#9cb386' : '#5a5a40',
                borderColor: isDark ? 'rgba(156,179,134,0.3)' : 'rgba(90,90,64,0.2)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Entrar
            </button>
          </div>

          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
            <h1
              className="text-lg sm:text-xl font-black tracking-tight"
              style={{ color: isDark ? '#e8e6df' : '#3a3a28' }}
            >
              Agronômica N-Pro
            </h1>
            <p
              className="text-[10px] tracking-[0.25em] uppercase font-medium"
              style={{ color: isDark ? '#6a7a5a' : '#8c897e' }}
            >
              Calculadora de Nitrogênio para Milho
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
