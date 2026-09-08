'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NumberTicker } from '@/components/godui/number-ticker';

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
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    const duration = 350;

    const stepFn = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
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

  return (
    <div
      className={`relative group ${className}`}
      style={style}
    >
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395] relative">
            <span className="text-[11px] font-normal uppercase tracking-wider block">
              {label}
            </span>
          </label>
          {unit && (
            <span className="text-xs font-mono font-bold text-[#5A5A40] dark:text-[#A3B18A]">
              <NumberTicker value={value} decimalPlaces={getDecimalPlaces(step)} className="text-xs font-mono font-bold text-[#5A5A40] dark:text-[#A3B18A]" /> {unit}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <div className="relative overflow-hidden rounded-xl">
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

        {derived && (
          <div className="absolute top-1.5 right-2 z-10">
            <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-[#2E6F40]/15 text-[#2E6F40] dark:text-[#86efac] border border-[#2E6F40]/20">
              Calculado
            </span>
          </div>
        )}
      </div>

      {hint && (
        <span className="text-[10px] text-[#8C897E] block mt-1">{hint}</span>
      )}
    </div>
  );
});
