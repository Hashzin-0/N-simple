'use client';

import React, { InputHTMLAttributes, forwardRef } from 'react';
import NeonBorderWrapper from './NeonBorderWrapper';
import { cn, neonFocusClasses } from '@/lib/utils';

export type NeonInputProps = InputHTMLAttributes<HTMLInputElement> & {
  isDark?: boolean;
  inputBg?: string;
  borderColor?: string;
  label?: string;
};

const NeonInput = forwardRef<HTMLInputElement, NeonInputProps>(
  ({ className, isDark, inputBg, borderColor, label, ...props }, ref) => {
    return (
      <NeonBorderWrapper className="mb-1">
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-xl border transition-colors',
            inputBg || (isDark ? 'bg-[#1A1E18]' : 'bg-[#FDFBF7]'),
            borderColor || (isDark ? 'border-[#2C3328]' : 'border-[#E5E2D9]'),
            'text-[#5A5A40] dark:text-[#E8E6DF]',
            'placeholder:text-[#8C897E] dark:placeholder:text-[#9EA399]',
            neonFocusClasses,
            className,
          )}
          {...props}
        />
      </NeonBorderWrapper>
    );
  }
);

NeonInput.displayName = 'NeonInput';
export default NeonInput;
