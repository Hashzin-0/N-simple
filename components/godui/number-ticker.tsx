'use client';

import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import * as React from 'react';

export type NumberTickerProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> & {
  value: number;
  startValue?: number;
  direction?: 'up' | 'down';
  delay?: number;
  decimalPlaces?: number;
  damping?: number;
  stiffness?: number;
};

const NumberTicker = React.forwardRef<HTMLSpanElement, NumberTickerProps>(
  (
    {
      value,
      startValue = 0,
      direction = 'up',
      delay = 0,
      decimalPlaces = 0,
      damping = 60,
      stiffness = 100,
      className,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = React.useRef<HTMLSpanElement>(null);
    const reduceMotion = useReducedMotion();
    const motionValue = useMotionValue(
      direction === 'down' ? value : startValue,
    );
    const springValue = useSpring(motionValue, { damping, stiffness });
    const isInView = useInView(ref, { once: false, margin: '0px' });

    React.useImperativeHandle(
      forwardedRef,
      () => ref.current as HTMLSpanElement,
    );

    React.useEffect(() => {
      if (!isInView) return;

      const target = direction === 'down' ? startValue : value;
      const timer = setTimeout(() => {
        motionValue.set(target);
        if (reduceMotion) springValue.jump(target);
      }, delay * 1000);

      return () => clearTimeout(timer);
    }, [
      motionValue,
      springValue,
      isInView,
      delay,
      value,
      direction,
      startValue,
      reduceMotion,
    ]);

    React.useEffect(
      () =>
        springValue.on('change', (latest) => {
          if (ref.current) {
            ref.current.textContent = Intl.NumberFormat('en-US', {
              minimumFractionDigits: decimalPlaces,
              maximumFractionDigits: decimalPlaces,
            }).format(Number(latest.toFixed(decimalPlaces)));
          }
        }),
      [springValue, decimalPlaces],
    );

    const formatter = React.useMemo(
      () =>
        new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }),
      [decimalPlaces],
    );

    return (
      <span
        ref={ref}
        data-slot="number-ticker"
        className={`inline-block tabular-nums tracking-wider ${className ?? ''}`}
        {...props}
      >
        {formatter.format(direction === 'down' ? value : startValue)}
      </span>
    );
  },
);
NumberTicker.displayName = 'NumberTicker';

export { NumberTicker };