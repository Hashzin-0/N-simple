'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { AvaliacaoResultado, TutorAttemptPayload, TutorProgressEntry } from '@/lib/tutor/types';

const STORAGE_KEY = 'tutor_progress_v1';
const DEVICE_KEY = 'tutor_device_id';
const PROGRESS_EVENT = 'tutor_progress_update';

type LocalProgressMap = Record<string, TutorProgressEntry>;

let cachedRaw: string | null = null;
let cachedData: LocalProgressMap = {};

function getSnapshot(): LocalProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      if (cachedRaw !== null) {
        cachedRaw = null;
        cachedData = {};
      }
      return cachedData;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedData = JSON.parse(raw);
    }
    return cachedData;
  } catch {
    return {};
  }
}

function getServerSnapshot(): LocalProgressMap {
  return {};
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener(PROGRESS_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

function saveToLocal(data: LocalProgressMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function getTutorDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `tutor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function statusToScore(status: string): number {
  if (status === 'dominou') return 1;
  if (status === 'parcial') return 0.55;
  return 0.15;
}

function applyLocalUpdate(topic: string, avaliacao: AvaliacaoResultado): LocalProgressMap {
  const data = { ...getSnapshot() };
  const prev = data[topic];
  const score = statusToScore(avaliacao.statusGeral);
  const attempts = (prev?.attempts || 0) + 1;
  const prevMastery = prev?.masteryEstimate ?? 0;
  const mastery =
    attempts === 1 ? score : prevMastery * 0.65 + score * 0.35;

  let strengths = [...(prev?.strengths || [])];
  let weaknesses = [...(prev?.weaknesses || [])];

  const upsert = (arr: string[], item: string) => {
    const clean = item.trim();
    if (!clean) return arr;
    return [clean, ...arr.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  };

  for (const c of avaliacao.conceitosCorretos || []) {
    strengths = upsert(strengths, c);
    weaknesses = weaknesses.filter((w) => w.toLowerCase() !== c.toLowerCase());
  }
  for (const c of [...(avaliacao.omissoes || []), ...(avaliacao.errosConceituais || [])]) {
    weaknesses = upsert(weaknesses, c);
  }

  data[topic] = {
    topic,
    attempts,
    strengths,
    weaknesses,
    masteryEstimate: Math.round(mastery * 1000) / 1000,
    lastReview: new Date().toISOString(),
  };

  return data;
}

function mergeServerEntries(serverEntries: TutorProgressEntry[]): LocalProgressMap {
  const merged = { ...getSnapshot() };
  for (const entry of serverEntries) {
    const local = merged[entry.topic];
    if (!local || entry.attempts > local.attempts) {
      merged[entry.topic] = entry;
    }
  }
  return merged;
}

export function useTutorProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const userId = getTutorDeviceId();
    fetch(`/api/tutor/progress?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.source === 'supabase' && Array.isArray(data.entries)) {
          const merged = mergeServerEntries(data.entries as TutorProgressEntry[]);
          saveToLocal(merged);
        }
      })
      .catch(() => {
        // Supabase indisponível — usa apenas localStorage
      });
  }, []);

  const recordAttempt = useCallback(
    async (attempt: Omit<TutorAttemptPayload, 'userId'>): Promise<void> => {
      const userId = getTutorDeviceId();

      const next = applyLocalUpdate(attempt.topic, attempt.evaluation);
      saveToLocal(next);

      try {
        await fetch('/api/tutor/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, attempt: { ...attempt, userId } }),
        });
      } catch {
        // Supabase indisponível — local já foi salvo
      }
    },
    []
  );

  const getTopicProgress = useCallback(
    (topic: string): TutorProgressEntry | null => progress[topic] || null,
    [progress]
  );

  const listProgress = useCallback((): TutorProgressEntry[] => {
    return Object.values(progress).sort((a, b) => b.lastReview.localeCompare(a.lastReview));
  }, [progress]);

  return {
    progress,
    recordAttempt,
    getTopicProgress,
    listProgress,
    deviceId: typeof window !== 'undefined' ? getTutorDeviceId() : '',
  };
}
