"use client";

import * as React from "react";

export type GooeyStackProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  children?: React.ReactNode;
  gap?: number;
  collapsed?: boolean;
  expandedGap?: number;
  collapsedGap?: number;
  gooeyness?: number;
  radius?: number;
};

const GooeyStack = React.forwardRef<HTMLDivElement, GooeyStackProps>(
  (
    {
      children,
      gap,
      collapsed = false,
      expandedGap = 18,
      className,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => ref.current as HTMLDivElement,
    );

    const items = React.Children.toArray(children);
    const g = gap ?? expandedGap;

    return (
      <div
        ref={ref}
        data-slot="gooey-stack"
        data-collapsed={collapsed ? "true" : undefined}
        className={`relative w-full ${className ?? ""}`}
        style={style}
        {...props}
      >
        {items.map((child, i) => (
          <div
            key={i}
            className="relative"
            style={{
              marginBottom: i < items.length - 1 ? g : 0,
              zIndex: i,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  },
);
GooeyStack.displayName = "GooeyStack";

export { GooeyStack };
