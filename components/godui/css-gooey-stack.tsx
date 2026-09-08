"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

export type CssGooeyStackProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  children?: React.ReactNode;
  collapsed?: boolean;
};

const SPRING = {
  type: "spring",
  stiffness: 160,
  damping: 22,
  mass: 0.9,
} as const;

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
    const rawId = React.useId();
    const filterId = `gooey-split-filter-${rawId.replace(/:/g, "")}`;
    const reduceMotion = useReducedMotion() ?? false;
    const items = React.Children.toArray(children);

    const [containerHeight, setContainerHeight] = React.useState<number>(56);
    const measureRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
      if (measureRef.current) {
        const h = measureRef.current.offsetHeight;
        if (h > 0) setContainerHeight(h);
      }
    }, [items]);

    const transition = reduceMotion ? { duration: 0 } : SPRING;

    return (
      <div
        ref={forwardedRef}
        data-slot="css-gooey-stack"
        data-collapsed={collapsed ? "true" : undefined}
        className={`relative w-full select-none ${className ?? ""}`}
        style={{ ...style, minHeight: containerHeight }}
        {...props}
      >
        {/* Invisible measurement element to track natural height */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible opacity-0 absolute top-0 left-0 w-full"
        >
          {items[0]}
        </div>

        {/* 
          LIQUID METABALL LAYER (BACKGROUND PODS)
          Renders fused silhouettes with gooey SVG filter to create
          the biological cell-division / splitting blob effect.
        */}
        <div
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            filter: reduceMotion ? undefined : `url(#${filterId})`,
          }}
        >
          <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
              <filter
                id={filterId}
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"
                  result="goo"
                />
              </filter>
            </defs>
          </svg>

          {/* Liquid Blob 1 (Left / Primary) */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 rounded-2xl bg-[#ECE8DF] dark:bg-[#252C22] shadow-inner"
            initial={false}
            animate={{
              width: collapsed ? "100%" : "calc(50% - 6px)",
            }}
            transition={transition}
          />

          {/* Liquid Blob 2 (Right / Emerges and splits out) */}
          {items.length > 1 && (
            <motion.div
              className="absolute top-0 bottom-0 rounded-2xl bg-[#ECE8DF] dark:bg-[#252C22] shadow-inner"
              initial={false}
              animate={
                collapsed
                  ? {
                      left: "0%",
                      width: "100%",
                      opacity: 0,
                      scale: 0.85,
                    }
                  : {
                      left: "calc(50% + 6px)",
                      width: "calc(50% - 6px)",
                      opacity: 1,
                      scale: 1,
                    }
              }
              transition={transition}
            />
          )}
        </div>

        {/* 
          INTERACTIVE CONTROLS LAYER (CRYSTAL CLEAR ON TOP)
          Interactive inputs are rendered above the liquid layer without any
          filter blur, ensuring sharp typography, focus rings and clickability.
        */}
        <div className="relative w-full h-full z-10">
          {/* Input 1 (Min / Single) */}
          <motion.div
            className="relative"
            initial={false}
            animate={{
              width: collapsed ? "100%" : "calc(50% - 6px)",
            }}
            transition={transition}
          >
            {items[0]}
          </motion.div>

          {/* Input 2 (Max / Split Range) */}
          {items.length > 1 && (
            <motion.div
              className="absolute top-0 right-0"
              initial={false}
              animate={
                collapsed
                  ? {
                      width: "calc(50% - 6px)",
                      x: -20,
                      opacity: 0,
                      pointerEvents: "none",
                    }
                  : {
                      width: "calc(50% - 6px)",
                      x: 0,
                      opacity: 1,
                      pointerEvents: "auto",
                    }
              }
              transition={transition}
            >
              {items[1]}
            </motion.div>
          )}
        </div>
      </div>
    );
  },
);

CssGooeyStack.displayName = "CssGooeyStack";

export { CssGooeyStack };
