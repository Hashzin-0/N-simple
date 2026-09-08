'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAnimationLock } from '@/lib/useAnimationLock';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface Select3DProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  label?: string;
  isDark?: boolean;
  accentColor?: string;
  className?: string;
}

export default React.memo(function Select3D({
  id,
  value,
  options,
  onChange,
  label,
  isDark = false,
  accentColor = '#D4A373',
  className = '',
}: Select3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className={`space-y-2 ${className}`} id={id}>
      {label && (
        <label className="block text-[11px] font-bold text-[#8C897E] dark:text-[#A6A395] uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="relative">
        {/* SHADOW LAYER — inset: inner shadow at top */}
        <div
          className="absolute inset-0 rounded-xl -translate-y-[1px]"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.18) 100%)'
              : 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.08) 100%)',
            filter: 'blur(4px)',
          }}
          aria-hidden="true"
        />

        {/* EDGE LAYER — inset: subtle top edge */}
        <div
          className="absolute inset-0 rounded-xl -translate-y-[0.5px]"
          style={{
            background: `linear-gradient(135deg, ${accentColor}88 0%, ${accentColor}55 50%, ${accentColor}77 100%)`,
          }}
          aria-hidden="true"
        />

        {/* FRONT FACE — the actual select grid, pressed into surface */}
        <motion.div
          className="relative rounded-xl translate-y-[1px]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            className={`grid gap-1.5 p-1 rounded-xl border ${
              isDark
                ? 'bg-[#151813] border-[#2C3328]'
                : 'bg-[#F9F8F6] border-[#E5E2D9]'
            }`}
          >
            {options.map((opt, idx) => {
              const isActive = value === opt.value;
              const isHovered = hoveredIdx === idx;

              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="relative text-left px-3 py-2.5 rounded-lg font-bold text-xs transition-all duration-200 overflow-visible"
                  style={{
                    transformStyle: 'preserve-3d',
                    boxShadow: isActive
                      ? `0 4px 14px ${accentColor}88, 0 0 16px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.18)`
                      : isHovered
                      ? `0 2px 8px rgba(0,0,0,0.10)`
                      : 'none',
                  }}
                  animate={{
                    y: isActive ? -3 : 0,
                    rotateX: isActive ? 0 : isHovered ? 2 : 0,
                    rotateY: isActive ? 0 : isHovered ? -1 : 0,
                    scale: isActive ? 1.02 : isHovered ? 1.01 : 1,
                    z: isActive ? 15 : isHovered ? 5 : 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                  }}
                >
                  {/* EDGE LAYER — accent color depth, visible when elevated */}
                  <span
                    className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-200"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${accentColor}dd 0%, ${accentColor}99 50%, ${accentColor}bb 100%)`,
                      transform: 'translateY(2px)',
                      opacity: isActive ? 1 : 0,
                    }}
                    aria-hidden="true"
                  />

                  <div className="relative z-10 flex items-center gap-2 overflow-hidden rounded-lg">
                    {opt.icon && (
                      <motion.span
                        animate={{ rotateY: isActive ? 360 : 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      >
                        {opt.icon}
                      </motion.span>
                    )}
                    <div>
                      <span
                        className={`block ${
                          isActive
                            ? 'text-white'
                            : isDark
                            ? 'text-[#C5C4B8]'
                            : 'text-[#5A5A40]'
                        }`}
                      >
                        {opt.label}
                      </span>
                      {opt.description && (
                        <span
                          className={`block text-[10px] font-normal mt-0.5 ${
                            isActive
                              ? 'text-white/75'
                              : 'text-[#8C897E] dark:text-[#9EA399]'
                          }`}
                        >
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <motion.div
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 600,
                        damping: 20,
                      }}
                    >
                      <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
});
