'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseScrollSpyOptions {
  sectionIds: string[];
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
}

export function useScrollSpy({
  sectionIds,
  enabled = true,
}: UseScrollSpyOptions): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);
  const rafRef = useRef<number | null>(null);
  const sectionKey = useMemo(() => sectionIds.join(','), [sectionIds]);

  const updateActiveSection = useCallback(() => {
    if (!enabled || sectionIds.length === 0) return;

    // Trigger line at 30% from the top of the viewport
    const triggerY = window.innerHeight * 0.32;
    const isAtBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 50;

    // If reached the bottom of the page, activate the last section
    if (isAtBottom && sectionIds.length > 0) {
      setActiveId(sectionIds[sectionIds.length - 1]);
      return;
    }

    let currentBestId: string | null = null;
    let minDistanceToTrigger = Infinity;

    for (let i = 0; i < sectionIds.length; i++) {
      const id = sectionIds[i];
      const el = document.getElementById(id);
      if (!el) continue;

      const rect = el.getBoundingClientRect();

      // If the top of the section has reached or passed the trigger line,
      // and the bottom of the section hasn't completely scrolled away
      if (rect.top <= triggerY + 40 && rect.bottom >= triggerY - 40) {
        currentBestId = id;
      } else if (!currentBestId && rect.top > triggerY) {
        // Find closest coming up if none has passed trigger yet
        const dist = rect.top - triggerY;
        if (dist < minDistanceToTrigger) {
          minDistanceToTrigger = dist;
          currentBestId = id;
        }
      }
    }

    if (currentBestId) {
      setActiveId((prev) => (prev === currentBestId ? prev : currentBestId));
    }
  }, [enabled, sectionIds]);

  useEffect(() => {
    if (!enabled || sectionIds.length === 0) return;

    const onScrollOrResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateActiveSection);
    };

    // Initial check
    onScrollOrResize();

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sectionKey, enabled, updateActiveSection, sectionIds.length]);

  return activeId;
}

