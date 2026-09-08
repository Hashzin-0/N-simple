'use client';

import React, { SelectHTMLAttributes, forwardRef } from 'react';
import NeonBorderWrapper from './NeonBorderWrapper';
import { cn, neonFocusClasses } from '@/lib/utils';

export type NeonSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  isDark?: boolean;
  inputBg?: string;
  borderColor?: string;
  label?: string;
};

const NeonSelect = forwardRef<HTMLSelectElement, NeonSelectProps>(
  ({ className, isDark, inputBg, borderColor, label, children, ...props }, ref) => {
    return (
      <NeonBorderWrapper className="mb-1">
        <select
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
            inputBg || (isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]'),
            borderColor || (isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]'),
            'text-[#5A5A40] dark:text-[#E8E6DF]',
            neonFocusClasses,
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </NeonBorderWrapper>
    );
  }
);

NeonSelect.displayName = 'NeonSelect';
export default NeonSelect;
