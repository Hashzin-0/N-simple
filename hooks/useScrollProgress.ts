'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue } from 'motion/react';

/**
 * Returns a MotionValue<number> (0–1) representing scroll progress.
 * Updates on scroll via requestAnimationFrame — no React re-renders.
 * 0 = top of page, 1 = bottom of page.
 */
export function useScrollProgress() {
  const progress = useMotionValue(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        progress.set(Math.min(Math.max(scrollTop / docHeight, 0), 1));
      }
      rafRef.current = null;
    };

    const onScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [progress]);

  return progress;
}
