'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { LibrasModuleProgress } from '@/lib/libras-types';
import { ALL_MODULES } from '@/lib/libras-course-data';
import { useAuth } from '@/components/auth/AuthProvider';

const STORAGE_KEY = 'libras_progress_v1';
const PROGRESS_EVENT = 'libras_progress_update';

type ProgressData = Record<string, { learned: boolean; quizScore: number }>;

// --- localStorage helpers ---
let cachedRaw: string | null = null;
let cachedData: ProgressData = {};

function getSnapshot(): ProgressData {
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

function getServerSnapshot(): ProgressData {
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

function saveToLocalStorage(data: ProgressData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

function syncToServer(
  cloudUserId: string | null,
  wordId: string,
  moduleId: string,
  learned: boolean,
  quizScore: number
) {
  if (!cloudUserId) return;
  fetch('/api/libras/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: cloudUserId,
      entries: [{ word_id: wordId, learned, quiz_score: quizScore, module_id: moduleId }],
    }),
  }).catch(() => {
    // Supabase unavailable, ignore
  });
}

// --- Hook ---
export function useLibrasProgress() {
  const localProgress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { user, loading: authLoading } = useAuth();
  const cloudUserId = user?.id ?? null;

  // Sync com Supabase apenas logado (user.id)
  useEffect(() => {
    if (authLoading || !cloudUserId) return;
    fetch(`/api/libras/progress?userId=${encodeURIComponent(cloudUserId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.source === 'supabase' && Array.isArray(data.entries)) {
          const merged = { ...getSnapshot() };
          for (const entry of data.entries) {
            const existing = merged[entry.word_id];
            if (!existing || entry.quiz_score > existing.quizScore) {
              merged[entry.word_id] = {
                learned: entry.learned,
                quizScore: entry.quiz_score,
              };
            }
          }
          saveToLocalStorage(merged);
        }
      })
      .catch(() => {
        // Supabase unavailable, use local only
      });
  }, [authLoading, cloudUserId]);

  const markLearned = useCallback(
    (wordId: string, moduleId: string) => {
      const data = { ...getSnapshot() };
      data[wordId] = { learned: true, quizScore: data[wordId]?.quizScore || 0 };
      saveToLocalStorage(data);
      syncToServer(cloudUserId, wordId, moduleId, true, data[wordId].quizScore);
    },
    [cloudUserId]
  );

  const saveQuizScore = useCallback(
    (wordId: string, moduleId: string, score: number) => {
      const data = { ...getSnapshot() };
      data[wordId] = { learned: data[wordId]?.learned || false, quizScore: score };
      saveToLocalStorage(data);
      syncToServer(cloudUserId, wordId, moduleId, data[wordId].learned, score);
    },
    [cloudUserId]
  );

  const getModuleProgress = useCallback(
    (moduleId: string): LibrasModuleProgress => {
      const mod = ALL_MODULES.find((m) => m.id === moduleId);
      if (!mod) {
        return { moduleId, totalWords: 0, learnedWords: 0, quizScore: 0, completed: false };
      }

      const totalWords = mod.words.length;
      let learnedWords = 0;
      let totalScore = 0;
      let scoredCount = 0;

      for (const word of mod.words) {
        const p = localProgress[word.id];
        if (p?.learned) learnedWords++;
        if (p?.quizScore && p.quizScore > 0) {
          totalScore += p.quizScore;
          scoredCount++;
        }
      }

      return {
        moduleId,
        totalWords,
        learnedWords,
        quizScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
        completed: learnedWords === totalWords && totalWords > 0,
      };
    },
    [localProgress]
  );

  const isLearned = useCallback(
    (wordId: string) => localProgress[wordId]?.learned || false,
    [localProgress]
  );

  const getQuizScore = useCallback(
    (wordId: string) => localProgress[wordId]?.quizScore || 0,
    [localProgress]
  );

  const resetModule = useCallback((moduleId: string) => {
    const mod = ALL_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    const data = { ...getSnapshot() };
    for (const word of mod.words) {
      delete data[word.id];
    }
    saveToLocalStorage(data);
  }, []);

  return {
    markLearned,
    saveQuizScore,
    getModuleProgress,
    isLearned,
    getQuizScore,
    resetModule,
    cloudUserId,
  };
}
