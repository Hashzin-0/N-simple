'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getVoiceNoiseState,
  setVoiceNoiseState,
  subscribeVoiceNoise,
  type VoiceNoiseState,
} from '@/lib/noiseGate';

const PUSH_DEBOUNCE_MS = 400;

interface VoiceSettingsApiResponse {
  settings?: {
    modo: VoiceNoiseState['modo'];
    distancia_cm: number;
    updatedAt: number;
  } | null;
  source?: string;
}

/**
 * Sincroniza a preferência do supressor de ruído com a nuvem.
 *
 * Local-first: a store do `lib/noiseGate.ts` (localStorage) é sempre a fonte
 * de leitura — offline e anônimo funcionam normalmente. A nuvem só entra com
 * usuário logado (cloud gate do AuthProvider, mesmo padrão de progresso do
 * repo):
 *
 * - pull no login: `GET /api/user/settings` → vence o `updatedAt` mais novo
 *   (local ganha se o usuário mexeu deslogado; nuvem ganha se mudou em outro
 *   dispositivo);
 * - push com debounce (400 ms) a cada mudança local → `POST`.
 */
export function useVoiceSettingsSync(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: VoiceNoiseState | null = null;
    /** updatedAt da última coisa sincronizada — evita empurrar um pull. */
    let syncedAt = 0;

    const flush = () => {
      timer = null;
      if (!pending) return;
      const state = pending;
      pending = null;
      syncedAt = state.updatedAt;
      void fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, voice: state }),
      }).catch(() => {
        // Offline: o valor local continua valendo; a próxima mudança ou
        // login tenta de novo (local.updatedAt ainda maior que o da nuvem).
      });
    };

    const schedule = (state: VoiceNoiseState) => {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, PUSH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeVoiceNoise((state) => {
      if (state.updatedAt === syncedAt) return; // veio do pull da nuvem
      schedule(state);
    });

    (async () => {
      try {
        const res = await fetch(
          `/api/user/settings?userId=${encodeURIComponent(userId)}`
        );
        const data = (await res.json().catch(() => ({}))) as VoiceSettingsApiResponse;
        if (cancelled) return;

        const local = getVoiceNoiseState();
        const cloud = data.settings ?? null;
        const cloudAt = Number(cloud?.updatedAt) || 0;

        if (cloud && cloudAt > local.updatedAt) {
          syncedAt = cloudAt;
          setVoiceNoiseState({
            modo: cloud.modo,
            distancia_cm: cloud.distancia_cm,
            updatedAt: cloudAt,
          });
        } else {
          syncedAt = local.updatedAt;
          // Local mais novo (mexeu deslogado) ou nuvem ainda vazia → materializa.
          if (local.updatedAt > 0 && local.updatedAt !== cloudAt) {
            schedule(local);
          }
        }
      } catch {
        // Sem rede agora — local segue como fonte; tenta de novo no login.
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [userId]);
}
