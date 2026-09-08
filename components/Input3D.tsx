'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react';
import MorphText from '@/components/MorphText';
import { NumberTicker } from '@/components/godui/number-ticker';
import { ElasticText } from '@/components/godui/elastic-text';

interface Input3DProps {
  id?: string;
  value: number;
  onChange: (val: number) => void;
  onBlurCustom?: (val: number) => void;
  label?: string;
  labelMorph?: boolean;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  isDark?: boolean;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
  derived?: boolean;
  warning?: boolean;
  critical?: boolean;
  hint?: string;
  filling?: boolean;
}

export default React.memo(function Input3D({
  id,
  value,
  onChange,
  onBlurCustom,
  label,
  labelMorph = false,
  unit = '',
  step = 1,
  min,
  max,
  placeholder,
  isDark = false,
  accentColor = '#5A5A40',
  className = '',
  style,
  readOnly = false,
  derived = false,
  warning = false,
  critical = false,
  hint,
  filling = false,
}: Input3DProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const prevValueRef = useRef(value);
  const displaySpanRef = useRef<HTMLSpanElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [animDirection, setAnimDirection] = useState<'up' | 'down'>('up');
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) return str.split('.')[1].length;
    return 0;
  };

  const decimalPlaces = useMemo(() => getDecimalPlaces(step), [step]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }), [decimalPlaces]);

  const formatNumber = (num: number): string => numberFormatter.format(num);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = to;

    if (from === to) return;

    const direction = to > from ? 'up' : 'down';
    setAnimDirection(direction);
    setIsAnimating(true);

    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 450);

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    const startTime = performance.now();
    const duration = 350; // ms — snappy & ultra-fluid

    const stepFn = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Fluid easeOutCubic curve
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * ease;

      if (displaySpanRef.current) {
        displaySpanRef.current.textContent = formatNumber(current);
      }

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(stepFn);
      } else {
        if (displaySpanRef.current) {
          displaySpanRef.current.textContent = formatNumber(to);
        }
      }
    };

    rafIdRef.current = requestAnimationFrame(stepFn);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [value, step, decimalPlaces]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Warm up CSS 3D compositing layers on mount so first focus doesn't lag
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.willChange = 'transform';
    const timer = setTimeout(() => {
      el.style.willChange = 'auto';
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const tiltX = useTransform(mouseY, [-0.5, 0.5], [3, -3]);
  const tiltY = useTransform(mouseX, [-0.5, 0.5], [-3, 3]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  const borderColor = critical
    ? '#ef4444'
    : warning
    ? '#f59e0b'
    : filling
    ? '#22c55e'
    : isFocused
    ? accentColor
    : isDark
    ? '#393E32'
    : '#E5E2D9';

  const edgeColor = critical
    ? '#991b1b'
    : warning
    ? '#92400e'
    : filling
    ? '#166534'
    : accentColor;

  return (
    <motion.div
      ref={containerRef}
      className={`relative group ${className}`}
      style={{ perspective: 600, ...style }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395] relative">
            {labelMorph ? (
              <MorphText
                text={label}
                accentColor={accentColor}
                darkAccentColor={isDark ? '#9CB386' : '#5A5A40'}
              />
            ) : (
              <>
                {/* Simple span: visible when NOT focused */}
                {!isFocused && (
                  <span className="text-[11px] font-normal uppercase tracking-wider block">
                    {label}
                  </span>
                )}
                {/* ElasticText: always mounted, fades in on focus. Pre-mounted to avoid cold-start lag. */}
                <ElasticText
                  className={`text-[11px] font-normal uppercase tracking-wider ${
                    isFocused
                      ? 'relative block opacity-100 transition-opacity duration-200'
                      : 'absolute inset-0 opacity-0 pointer-events-none'
                  }`}
                  mode="auto"
                  startOnView={false}
                >
                  {label}
                </ElasticText>
              </>
            )}
          </label>
          {unit && (
            <span className="text-xs font-mono font-bold text-[#5A5A40] dark:text-[#A3B18A]">
              <NumberTicker value={value} decimalPlaces={getDecimalPlaces(step)} className="text-xs font-mono font-bold text-[#5A5A40] dark:text-[#A3B18A]" /> {unit}
            </span>
          )}
        </div>
      )}

      <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
        {/* SHADOW LAYER — MagicButton inspired */}
        <motion.div
          className={`absolute inset-0 rounded-xl ${isFocused ? 'translate-y-[1px]' : isHovered ? 'translate-y-[5px]' : 'translate-y-[2px]'} ${
            isFocused ? 'animate-magic-rainbow' : ''
          }`}
          animate={{
            rotateX: filling ? 2 : isFocused ? 1.5 : isHovered ? 0.5 : 0,
            rotateY: filling ? -1 : isFocused ? -0.5 : isHovered ? 0.3 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: filling ? 200 : isFocused ? 350 : 450,
            damping: 22,
          }}
          style={{
            backgroundImage: isFocused
              ? 'linear-gradient(90deg, var(--rainbow-1), var(--rainbow-5), var(--rainbow-3), var(--rainbow-4), var(--rainbow-2))'
              : isDark
              ? 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.25) 100%)'
              : 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.12) 100%)',
            backgroundSize: isFocused ? '200% 100%' : undefined,
            filter: isFocused ? 'blur(10px)' : 'blur(6px)',
            opacity: isFocused ? 0.6 : 1,
            transition: 'translate 300ms cubic-bezier(0.3,0.7,0.4,1), filter 300ms, opacity 300ms',
          } as React.CSSProperties}
          aria-hidden="true"
        />

        {/* EDGE LAYER — MagicButton inspired, shows accent color depth */}
        <motion.div
          className={`absolute inset-0 rounded-xl ${isFocused ? 'translate-y-[0px]' : isHovered ? 'translate-y-[3px]' : 'translate-y-[1px]'} ${
            isFocused ? 'animate-magic-rainbow' : ''
          }`}
          animate={{
            rotateX: filling ? 2 : isFocused ? 1.5 : isHovered ? 0.5 : 0,
            rotateY: filling ? -1 : isFocused ? -0.5 : isHovered ? 0.3 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: filling ? 200 : isFocused ? 350 : 450,
            damping: 22,
          }}
          style={{
            backgroundImage: isFocused
              ? 'linear-gradient(90deg, var(--rainbow-1), var(--rainbow-5), var(--rainbow-3), var(--rainbow-4), var(--rainbow-2))'
              : `linear-gradient(135deg, ${edgeColor}dd 0%, ${edgeColor}99 50%, ${edgeColor}bb 100%)`,
            backgroundSize: isFocused ? '200% 100%' : undefined,
            transition: 'translate 300ms cubic-bezier(0.3,0.7,0.4,1)',
          } as React.CSSProperties}
          aria-hidden="true"
        />

        {/* FRONT FACE — the actual input */}
        <motion.div
          className="relative"
          animate={{
            rotateX: filling ? 2 : isFocused ? 1.5 : isHovered ? 0.5 : 0,
            rotateY: filling ? -1 : isFocused ? -0.5 : isHovered ? 0.3 : 0,
            y: isFocused ? 0 : isHovered ? -5 : -4,
          }}
          transition={{
            type: 'spring',
            stiffness: filling ? 200 : isFocused ? 350 : 450,
            damping: 22,
          }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="relative overflow-hidden rounded-xl">
            {/* Shimmer border effect on focus */}
            {(isFocused || filling) && !readOnly && (
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-10"
                style={{
                  backgroundImage: filling
                    ? `linear-gradient(90deg, transparent, rgba(34,197,94,0.3), transparent)`
                    : `linear-gradient(90deg, transparent, ${accentColor}33, transparent)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-border 2s ease-in-out infinite',
                }}
              />
            )}

            {/* Animated number display (when not focused) */}
            {!isFocused && (
              <div
                className={`absolute inset-0 flex items-center p-2.5 rounded-xl border text-sm font-medium ${
                  readOnly ? 'cursor-default opacity-80' : ''
                } ${
                  isDark ? 'bg-[#242720] text-[#F4F3EE]' : 'bg-white text-[#3D3D3D]'
                }`}
                style={{ borderColor, pointerEvents: 'none' }}
              >
                <span className="tabular-nums tracking-wider">
                  {value === 0 ? (
                    <span className="text-[#8C897E] dark:text-[#9EA399]">{placeholder || '0'}</span>
                  ) : (
                    <span
                      ref={displaySpanRef}
                      className="tabular-nums tracking-wider transition-colors duration-300 inline-block"
                      style={{
                        color: isAnimating
                          ? animDirection === 'up'
                            ? '#22c55e'
                            : '#ef4444'
                          : undefined,
                      }}
                    >
                      {formatNumber(value)}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Actual input */}
            <input
              ref={inputRef}
              id={id}
              type="number"
              step={step}
              min={min}
              max={max}
              value={value === 0 ? '' : value}
              placeholder={placeholder || '0'}
              readOnly={readOnly}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onChange(val);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={(e) => {
                setIsFocused(false);
                const val = parseFloat(e.target.value);
                if (onBlurCustom) {
                  onBlurCustom(isNaN(val) ? 0 : val);
                } else if (e.target.value === '' || e.target.value === '-') {
                  onChange(0);
                }
              }}
              className={`w-full p-2.5 rounded-xl border text-sm font-medium focus:outline-none transition-all duration-200 ${
                readOnly ? 'cursor-default opacity-80' : ''
              } ${
                isDark ? 'bg-[#242720] text-[#F4F3EE]' : 'bg-white text-[#3D3D3D]'
              } ${
                critical
                  ? 'border-red-400 dark:border-red-500'
                  : warning
                  ? 'border-amber-400 dark:border-amber-500'
                  : ''
              }`}
              style={{
                borderColor,
                boxShadow: isFocused
                  ? `0 0 0 3px ${accentColor}44, 0 4px 12px -2px ${accentColor}33`
                  : 'none',
                opacity: isFocused ? 1 : 0,
              }}
            />

          </div>

          {/* Derived badge — outside overflow-hidden so it's never clipped */}
          {derived && (
            <div className="absolute top-1.5 right-2 z-10">
              <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-[#2E6F40]/15 text-[#2E6F40] dark:text-[#86efac] border border-[#2E6F40]/20">
                Calculado
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {hint && (
        <span className="text-[10px] text-[#8C897E] block mt-1">{hint}</span>
      )}
    </motion.div>
  );
});
