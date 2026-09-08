"use client";

import * as React from "react";

export type CssGooeyStackProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  children?: React.ReactNode;
  collapsed?: boolean;
};

const CssGooeyStack = React.forwardRef<HTMLDivElement, CssGooeyStackProps>(
  (
    {
      children,
      collapsed = false,
      className,
      style,
      ...props
    },
    forwardedRef,
  ) => {
    const items = React.Children.toArray(children);

    return (
      <div
        ref={forwardedRef}
        data-slot="css-gooey-stack"
        data-collapsed={collapsed ? "true" : undefined}
        className={`relative w-full select-none ${className ?? ""}`}
        style={style}
        {...props}
      >
        <div className="relative w-full h-full z-10">
          <div className="relative">
            {items[0]}
          </div>

          {items.length > 1 && (
            <div
              className="absolute top-0 right-0 transition-all duration-300 ease-out"
              style={{
                width: collapsed ? 0 : 'calc(50% - 6px)',
                opacity: collapsed ? 0 : 1,
                pointerEvents: collapsed ? 'none' : 'auto',
              }}
            >
              {items[1]}
            </div>
          )}
        </div>
      </div>
    );
  },
);
CssGooeyStack.displayName = "CssGooeyStack";

export { CssGooeyStack };
