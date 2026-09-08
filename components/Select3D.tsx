'use client';

import React, { useState } from 'react';

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
  return (
    <div className={`space-y-2 ${className}`} id={id}>
      {label && (
        <label className="block text-[11px] font-bold text-[#8C897E] dark:text-[#A6A395] uppercase tracking-wider">
          {label}
        </label>
      )}

      <div className="relative">
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

        <div
          className="absolute inset-0 rounded-xl -translate-y-[0.5px]"
          style={{
            background: `linear-gradient(135deg, ${accentColor}88 0%, ${accentColor}55 50%, ${accentColor}77 100%)`,
          }}
          aria-hidden="true"
        />

        <div className="relative rounded-xl translate-y-[1px]">
          <div
            className={`grid gap-1.5 p-1 rounded-xl border ${
              isDark
                ? 'bg-[#151813] border-[#2C3328]'
                : 'bg-[#F9F8F6] border-[#E5E2D9]'
            }`}
          >
            {options.map((opt) => {
              const isActive = value === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  className={`relative text-left px-3 py-2.5 rounded-lg font-bold text-xs transition-all duration-200 overflow-visible ${
                    isActive
                      ? 'text-white'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{
                    boxShadow: isActive
                      ? `0 4px 14px ${accentColor}88, 0 0 16px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.18)`
                      : 'none',
                    backgroundColor: isActive ? accentColor : undefined,
                  }}
                >
                  <div className="relative z-10 flex items-center gap-2 overflow-hidden rounded-lg">
                    {opt.icon && <span>{opt.icon}</span>}
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
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
