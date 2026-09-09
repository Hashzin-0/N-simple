'use client';

import { motion, useReducedMotion, PanInfo } from 'motion/react';
import * as React from 'react';

export type CardSwapProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> & {
  /** Cards to cycle through, front to back. Provide 2–10. */
  children?: React.ReactNode;
  /** Auto-advance interval in ms. Set `0` to disable. */
  interval?: number;
  /** Pause the auto-advance while the pointer is over the stack. */
  pauseOnHover?: boolean;
  /** Vertical offset (px) between stacked cards. */
  offsetY?: number;
  /** Horizontal offset (px) between stacked cards. */
  offsetX?: number;
  /** Scale step removed per card going back. */
  scaleStep?: number;
};

const CardSwap = React.forwardRef<HTMLDivElement, CardSwapProps>(
  (
    {
      children,
      interval = 0, // default disabled so user controls swap
      pauseOnHover = true,
      offsetY = 16,
      offsetX = 14,
      scaleStep = 0.04,
      className,
      onPointerMove,
      onPointerLeave,
      ...props
    },
    forwardedRef
  ) => {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(
      forwardedRef,
      () => ref.current as HTMLDivElement
    );
    const reduce = useReducedMotion();
    const items = React.Children.toArray(children);
    const n = items.length;

    // `order[r]` is the item index sitting at rank `r` (0 = front).
    const [order, setOrder] = React.useState<number[]>(() =>
      Array.from({ length: n }, (_, i) => i)
    );

    React.useEffect(() => {
      setOrder(Array.from({ length: n }, (_, i) => i));
    }, [n]);

    const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
    const [paused, setPaused] = React.useState(false);

    // Advance: front card moves to the back (drag left / swap left)
    const advance = React.useCallback(() => {
      setOrder((o) => (o.length ? [...o.slice(1), o[0] as number] : o));
    }, []);

    // Retreat: back card comes to the front (drag right / swap right)
    const retreat = React.useCallback(() => {
      setOrder((o) =>
        o.length ? [o[o.length - 1] as number, ...o.slice(0, -1)] : o
      );
    }, []);

    React.useEffect(() => {
      if (!interval || paused || n < 2) return;
      const t = setInterval(advance, interval);
      return () => clearInterval(t);
    }, [interval, paused, n, advance]);

    const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      if (reduce) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: -py * 8, y: px * 10 });
    };

    const handleLeave = (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(e);
      setTilt({ x: 0, y: 0 });
      if (pauseOnHover) setPaused(false);
    };

    // rank of each item index, so we can drive its slot from the item's position
    const rankOf = React.useMemo(() => {
      const m = new Array<number>(n);
      order.forEach((itemIndex, rank) => {
        m[itemIndex] = rank;
      });
      return m;
    }, [order, n]);

    // Handle horizontal drag / swap gestures
    const handleDragEnd = (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo
    ) => {
      const threshold = 45;
      const velocityThreshold = 250;

      if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
        // Swiped left -> Advance to next card
        advance();
      } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
        // Swiped right -> Retreat to previous card
        retreat();
      }
    };

    // Keyboard support: Left/Right arrows
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        advance();
      } else if (e.key === 'ArrowRight') {
        retreat();
      }
    };

    return (
      <div
        ref={ref}
        data-slot="card-swap"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerMove={handleMove}
        onPointerEnter={() => pauseOnHover && setPaused(true)}
        onPointerLeave={handleLeave}
        className={`relative grid place-items-center [perspective:1200px] outline-none select-none ${className ?? ''}`}
        {...props}
      >
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateX: tilt.x, rotateY: tilt.y }}
          transition={{
            type: 'spring',
            stiffness: 170,
            damping: 15,
            mass: 0.1,
          }}
        >
          {items.map((child, i) => {
            const r = rankOf[i] ?? 0;
            const isFront = r === 0;

            return (
              <motion.div
                key={i}
                className={`absolute inset-0 will-change-transform ${
                  isFront ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
                }`}
                style={{
                  zIndex: n - r,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                animate={{
                  x: r * offsetX,
                  y: -r * offsetY,
                  scale: 1 - r * scaleStep,
                  rotateZ: r * -1.8,
                  opacity: r > 3 ? 0 : 1 - r * 0.12,
                }}
                drag={isFront ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.45}
                onDragEnd={isFront ? handleDragEnd : undefined}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }
                }
              >
                {child}
              </motion.div>
            );
          })}
        </motion.div>

        {/* SWAP INDICATOR (SEM AS SETAS < E >, APENAS GESTO DE SWAP / PONTOS DE NAVEGAÇÃO) */}
        {n > 1 && (
          <div className="flex flex-col items-center gap-1.5 pt-6 pb-2 text-center">
            <div className="flex items-center gap-1.5">
              {items.map((_, dotIdx) => {
                const isActive = order[0] === dotIdx;
                return (
                  <button
                    key={dotIdx}
                    type="button"
                    onClick={() => {
                      // Rotate until dotIdx is at front
                      setOrder((prev) => {
                        const targetPos = prev.indexOf(dotIdx);
                        if (targetPos <= 0) return prev;
                        return [...prev.slice(targetPos), ...prev.slice(0, targetPos)];
                      });
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      isActive
                        ? 'w-6 bg-[#2E6F40] dark:bg-[#9CB386]'
                        : 'w-2 bg-black/15 dark:bg-white/15 hover:bg-black/30 dark:hover:bg-white/30'
                    }`}
                    aria-label={`Ver portal ${dotIdx + 1}`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] font-medium text-[#8C897E] dark:text-[#9EA399] flex items-center justify-center gap-1">
              <span>Arraste o card para a esquerda ou direita para alternar</span>
              <span className="text-[10px] font-mono text-[#5A5A40] dark:text-[#C5D9B0]">
                ({(order[0] ?? 0) + 1} de {n})
              </span>
            </span>
          </div>
        )}
      </div>
    );
  }
);
CardSwap.displayName = 'CardSwap';

export { CardSwap };
