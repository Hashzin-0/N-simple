'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useState wrapper that persists value to localStorage.
 * Reads from localStorage synchronously on first render (client only).
 * Saves with 300ms debounce to avoid excessive writes during rapid input changes.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(key);
  const mountedRef = useRef(false);

  // Lazy initializer: read from localStorage on client, fallback to default
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      // Corrupted data
    }
    return defaultValue;
  });

  // Sync key ref
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // Track mount for cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const setValueAndPersist = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof valueOrUpdater === 'function'
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;

        // Debounced save
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          try {
            localStorage.setItem(keyRef.current, JSON.stringify(next));
          } catch {
            // Storage full or unavailable
          }
        }, 300);

        return next;
      });
    },
    []
  );

  return [value, setValueAndPersist];
}
