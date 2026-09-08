'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';

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
  accentColor?: string; // e.g. '#5A5A40', '#D4A373', '#2E6F40'
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
  const [dragOffsetScale, setDragOffsetScale] = useState(1);
  const [tiltX, setTiltX] = useState(0);

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

      // Elastic drag scale & 3D tilt
      const distanceFromCenter = (boundedPos - 0.5) * 2;
      setTiltX(distanceFromCenter * 8);
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
      setDragOffsetScale(1);
      setTiltX(0);
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
    setDragOffsetScale(1.18);
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
      {/* Track & Elastic Thumb Container */}
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
        style={{
          perspective: '600px',
        }}
      >
        {/* 3D Track Background */}
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
          {/* Active Fill with 3D Depth */}
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: accentColor,
              backgroundImage:
                'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.15) 100%)',
              boxShadow: `0 0 10px ${accentColor}66`,
            }}
            transition={{
              type: 'spring',
              stiffness: isDragging ? 1000 : 400,
              damping: 30,
            }}
          />
        </div>

        {/* 3D Elastic Knob / Thumb */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -ml-3.5 w-7 h-7 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{
            left: `${percentage}%`,
            transformStyle: 'preserve-3d',
            rotateY: `${tiltX}deg`,
          }}
          animate={{
            scale: isDragging ? dragOffsetScale : 1,
            y: isDragging ? '-58%' : '-50%',
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 24,
          }}
        >
          {/* Thumb Outer 3D Bevel & Shadow */}
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
            {/* Center Indent */}
            <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />
          </div>

          {/* Floating 3D Value Tooltip (when dragging) */}
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.8 }}
              animate={{ opacity: 1, y: -28, scale: 1 }}
              className="absolute -top-3 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none whitespace-nowrap"
              style={{
                backgroundColor: accentColor,
                transform: 'perspective(400px) translateZ(10px)',
              }}
            >
              {clampedVal} {unit}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Min / Max Range Markers */}
      <div className="flex justify-between text-[10px] text-[#8C897E] dark:text-[#9EA399] font-semibold px-0.5">
        <span>{minLabel || `${min} ${unit}`}</span>
        <span>{maxLabel || `${max} ${unit}`}</span>
      </div>
    </div>
  );
}
