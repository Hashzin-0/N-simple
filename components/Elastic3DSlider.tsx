'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Elastic3DSliderProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  label?: string;
  unit?: string;
  isDark?: boolean;
  accentColor?: string;
  minLabel?: string;
  maxLabel?: string;
}

export default function Elastic3DSlider({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = '',
  isDark = false,
  accentColor = '#5A5A40',
  minLabel,
  maxLabel,
}: Elastic3DSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampedVal = Math.min(Math.max(value, min), max);
  const percentage = ((clampedVal - min) / (max - min)) * 100;

  const updateFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPos = (clientX - rect.left) / rect.width;
      const boundedPos = Math.max(0, Math.min(1, rawPos));
      let newVal = min + boundedPos * (max - min);

      if (step > 0) {
        newVal = Math.round(newVal / step) * step;
      }
      newVal = Number(Math.min(max, Math.max(min, newVal)).toFixed(step < 1 ? 2 : 0));
      onChange(newVal);
    },
    [min, max, step, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateFromPointer(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, updateFromPointer]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateFromPointer(e.clientX);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, clampedVal + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, clampedVal - step));
    }
  };

  return (
    <div className="space-y-1.5 select-none" id={id}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuenow={clampedVal}
        aria-valuemin={min}
        aria-valuemax={max}
        className="relative h-9 flex items-center cursor-pointer touch-none focus:outline-none group"
      >
        <div
          className={`relative w-full h-2.5 rounded-full transition-all overflow-hidden border ${
            isDark
              ? 'bg-[#151813] border-[#2C3328]'
              : 'bg-[#ECE8DF] border-[#DDD8CD]'
          }`}
          style={{
            boxShadow: isDark
              ? 'inset 0 2px 4px rgba(0,0,0,0.5)'
              : 'inset 0 2px 4px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${percentage}%`,
              backgroundColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}66`,
            }}
          />
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 -ml-3.5 w-7 h-7 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-150"
          style={{
            left: `${percentage}%`,
            transform: `translateY(${isDragging ? '-58%' : '-50%'}) scale(${isDragging ? 1.15 : 1})`,
          }}
        >
          <div
            className="w-full h-full rounded-full border-2 border-white flex items-center justify-center transition-shadow"
            style={{
              backgroundColor: accentColor,
              boxShadow: isDragging
                ? `0 8px 20px -2px rgba(0,0,0,0.4), 0 0 14px ${accentColor}`
                : '0 4px 10px rgba(0,0,0,0.25), inset 0 2px 2px rgba(255,255,255,0.4)',
              backgroundImage:
                'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.2) 100%)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />
          </div>

          {isDragging && (
            <div
              className="absolute -top-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none whitespace-nowrap transition-all duration-150"
              style={{
                backgroundColor: accentColor,
                opacity: 1,
                transform: 'translateY(-28px)',
              }}
            >
              {clampedVal} {unit}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-[#8C897E] dark:text-[#9EA399] font-semibold px-0.5">
        <span>{minLabel || `${min} ${unit}`}</span>
        <span>{maxLabel || `${max} ${unit}`}</span>
      </div>
    </div>
  );
}
