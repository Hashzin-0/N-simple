"use client";

import * as React from "react";

export type SplitFlapSize = "sm" | "md" | "lg";
export type SplitFlapAlign = "left" | "center" | "right";

export type SplitFlapDisplayProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  value: string;
  length?: number;
  align?: SplitFlapAlign;
  size?: SplitFlapSize;
  charset?: string | string[];
  stagger?: number;
  maxFlaps?: number;
};

const sizeClasses: Record<SplitFlapSize, string> = {
  sm: "h-9 px-2 text-xl",
  md: "h-14 px-3 text-4xl",
  lg: "h-20 px-4 text-6xl",
};

const alignClasses: Record<SplitFlapAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const SplitFlapDisplay = React.forwardRef<
  HTMLDivElement,
  SplitFlapDisplayProps
>(
  (
    {
      value,
      length,
      align = "left",
      size = "md",
      className,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => ref.current as HTMLDivElement,
    );

    const displayValue = length ? value.toUpperCase().padEnd(length).slice(0, length) : value.toUpperCase();

    return (
      <div
        ref={ref}
        role="img"
        aria-label={value}
        data-slot="split-flap-display"
        className={`inline-flex items-center gap-1 rounded-lg bg-muted font-mono font-semibold tabular-nums ${sizeClasses[size]} ${alignClasses[align]} ${className ?? ""}`}
        {...props}
      >
        {displayValue}
      </div>
    );
  },
);
SplitFlapDisplay.displayName = "SplitFlapDisplay";

export { SplitFlapDisplay };
