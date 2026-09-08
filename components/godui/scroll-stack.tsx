"use client";

import * as React from "react";

export type ScrollStackProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  height?: string;
  baseScale?: number;
  peek?: number;
  blur?: boolean;
  pinTop?: string;
};

const ScrollStack = React.forwardRef<HTMLDivElement, ScrollStackProps>(
  (
    {
      children,
      height,
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

    return (
      <div
        ref={ref}
        data-slot="scroll-stack"
        className={`${className ?? ""}`}
        style={height ? { height, ...style } : style}
        {...props}
      >
        {items.map((child, i) => (
          <div key={i}>
            {child}
          </div>
        ))}
      </div>
    );
  },
);
ScrollStack.displayName = "ScrollStack";

export { ScrollStack };
