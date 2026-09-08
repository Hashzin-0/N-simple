"use client";

import * as React from "react";

export type ElasticTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
  mode?: "auto" | "hover";
  minWeight?: number;
  maxWeight?: number;
  duration?: number;
  loop?: boolean;
  startOnView?: boolean;
  radius?: number;
};

const ElasticText = React.forwardRef<HTMLSpanElement, ElasticTextProps>(
  (
    {
      children,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <span
        ref={ref}
        data-slot="elastic-text"
        className={`${className ?? ""}`}
        {...props}
      >
        {children}
      </span>
    );
  },
);
ElasticText.displayName = "ElasticText";

export { ElasticText };
