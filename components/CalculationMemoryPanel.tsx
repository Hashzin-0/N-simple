'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
    <div style={{ perspective: '800px' }} className="w-full">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key="calc-memory-panel"
            initial={{
              rotateX: -90,
              opacity: 0,
              height: 0,
              transformOrigin: 'top center',
            }}
            animate={{
              rotateX: 0,
              opacity: 1,
              height: 'auto',
              transformOrigin: 'top center',
            }}
            exit={{
              rotateX: -90,
              opacity: 0,
              height: 0,
              transformOrigin: 'top center',
            }}
            transition={{
              type: 'spring',
              stiffness: 180,
              damping: 22,
              mass: 0.8,
              opacity: { duration: 0.25 },
              height: { type: 'spring', stiffness: 200, damping: 28 },
            }}
            className="overflow-hidden origin-top"
          >
            {/* Shadow overlay during unfold */}
            <motion.div
              initial={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}
              animate={{ boxShadow: '0 0px 0px rgba(0,0,0,0)' }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-b-2xl"
            >
              <div
                className={`mt-3 pt-3 border-t ${
                  isDark
                    ? 'border-[#2C3328] bg-[#151813]'
                    : 'border-[#E5E2D9] bg-[#F9F8F6]'
                } rounded-b-xl`}
              >
                {/* Header label */}
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

                {/* Step-by-step content */}
                <motion.div
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="text-xs space-y-2"
                >
                  {children}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
