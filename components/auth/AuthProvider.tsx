'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { initBrowserSupabase, getBrowserSupabase } from '@/lib/supabaseBrowser';
import type { PublicAuthConfig } from '@/lib/authConfig';
import type { TutorProgressEntry } from '@/lib/tutor/types';
import {
  mergeTutorMaps,
  mergeLibrasMap,
  type TutorProgressMap,
  type LibrasProgressMap,
} from '@/lib/progressMerge';

const DISMISS_KEY = 'npro_signin_island_dismissed';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  googleClientId: string | null;
  googleEnabled: boolean;
  islandDismissed: boolean;
  islandHeight: number;
  islandVisible: boolean;
  signInError: string | null;
  setSignInError: (msg: string | null) => void;
  setIslandHeight: (h: number) => void;
  dismissIsland: () => void;
  revealIsland: () => void;
  signOut: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string, nonce?: string) => Promise<void>;
  signInWithGoogleOAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({
  config,
  children,
}: {
  config: PublicAuthConfig;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(config.supabaseUrl && config.supabaseKey));
  const [islandDismissed, setIslandDismissed] = useState(false);
  const [islandHeight, setIslandHeight] = useState(0);
  const [signInError, setSignInError] = useState<string | null>(null);
  const mergedForUser = useRef<string | null>(null);

  const configured = Boolean(config.supabaseUrl && config.supabaseKey);

  useEffect(() => {
    if (!configured) return;
    const supabase = initBrowserSupabase(config.supabaseUrl, config.supabaseKey);
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setIslandDismissed(readDismissed());
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      if (next?.user) {
        // Login bem-sucedido: reexibe comportamento padrão da ilha (oculta por estar logado)
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch {
          /* ignore */
        }
        setIslandDismissed(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [configured, config.supabaseUrl, config.supabaseKey]);

  // Sync uma vez por sessão: local × nuvem → o mais avançado nos DOIS lados.
  // 1) GET progresso da nuvem (usuário Auth já existe via Google)
  // 2) Mescla com localStorage (max attempts/mastery; learned OR; score max)
  // 3) Grava o merged de volta no local e envia para a nuvem (idempotente)
  // 4) Nuvem vazia → empurra tudo do local. Nunca limpa o localStorage.
  useEffect(() => {
    if (!user?.id || mergedForUser.current === user.id) return;
    mergedForUser.current = user.id;
    let cancelled = false;

    const syncProgress = async () => {
      const userId = user.id;
      try {
        // ── Tutor: GET → merge → local + push ──
        const rawTutor = localStorage.getItem('tutor_progress_v1');
        let localTutor: TutorProgressMap = {};
        if (rawTutor) {
          try {
            localTutor = JSON.parse(rawTutor) as TutorProgressMap;
          } catch {
            localTutor = {};
          }
        }

        let cloudTutor: TutorProgressEntry[] = [];
        try {
          const res = await fetch(
            `/api/tutor/progress?userId=${encodeURIComponent(userId)}`
          );
          if (res.ok) {
            const body = await res.json();
            if (body?.source === 'supabase' && Array.isArray(body.entries)) {
              cloudTutor = body.entries as TutorProgressEntry[];
            }
          } else {
            console.warn('[AuthProvider] GET tutor nuvem:', res.status);
          }
        } catch (err) {
          console.warn('[AuthProvider] Rede GET tutor:', err);
        }

        const mergedTutor = mergeTutorMaps(localTutor, cloudTutor);
        const tutorList = Object.values(mergedTutor).filter((e) => e?.topic);
        if (tutorList.length > 0) {
          try {
            localStorage.setItem('tutor_progress_v1', JSON.stringify(mergedTutor));
            window.dispatchEvent(new Event('tutor_progress_update'));
          } catch {
            /* quota — segue só com push */
          }
          if (!cancelled && tutorList.length > 0) {
            const res = await fetch('/api/tutor/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, mergeEntries: tutorList }),
            });
            if (!res.ok) {
              console.warn('[AuthProvider] Push tutor falhou:', res.status);
            }
          }
        }

        // ── Libras: GET → merge → local + push ──
        const rawLibras = localStorage.getItem('libras_progress_v1');
        let localLibras: LibrasProgressMap = {};
        if (rawLibras) {
          try {
            localLibras = JSON.parse(rawLibras) as LibrasProgressMap;
          } catch {
            localLibras = {};
          }
        }

        let cloudLibras: Array<{ word_id: string; learned?: boolean; quiz_score?: number }> = [];
        try {
          const res = await fetch(
            `/api/libras/progress?userId=${encodeURIComponent(userId)}`
          );
          if (res.ok) {
            const body = await res.json();
            if (body?.source === 'supabase' && Array.isArray(body.entries)) {
              cloudLibras = body.entries;
            }
          } else {
            console.warn('[AuthProvider] GET libras nuvem:', res.status);
          }
        } catch (err) {
          console.warn('[AuthProvider] Rede GET libras:', err);
        }

        const mergedLibras = mergeLibrasMap(localLibras, cloudLibras);
        const librasEntries = Object.entries(mergedLibras).map(([wordId, v]) => ({
          word_id: wordId,
          learned: Boolean(v.learned),
          quiz_score: Number(v.quizScore) || 0,
          module_id: 'migrated',
        }));
        if (librasEntries.length > 0) {
          try {
            localStorage.setItem('libras_progress_v1', JSON.stringify(mergedLibras));
            window.dispatchEvent(new Event('libras_progress_update'));
          } catch {
            /* quota */
          }
          if (!cancelled) {
            const res = await fetch('/api/libras/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, entries: librasEntries }),
            });
            if (!res.ok) {
              console.warn('[AuthProvider] Push libras falhou:', res.status);
            }
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Sync local×nuvem incompleto:', err);
      }
      // Local NÃO é limpo: fallback offline se a nuvem falhar.
    };

    void syncProgress();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dismissIsland = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setIslandDismissed(true);
    setIslandHeight(0);
  }, []);

  const revealIsland = useCallback(() => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setIslandDismissed(false);
  }, []);

  const signInWithGoogleIdToken = useCallback(
    async (idToken: string, nonce?: string) => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setSignInError('Supabase não configurado.');
        return;
      }
      setSignInError(null);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        ...(nonce ? { nonce } : {}),
      });
      if (error) {
        setSignInError(error.message || 'Falha ao entrar com Google.');
        throw error;
      }
    },
    []
  );

  const signInWithGoogleOAuth = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setSignInError('Supabase não configurado.');
      return;
    }
    setSignInError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      setSignInError(error.message || 'Falha ao iniciar login com Google.');
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    // Usuário deslogado → ilha volta para permitir entrar/trocar conta
    revealIsland();
  }, [revealIsland]);

  const value = useMemo<AuthContextValue>(() => {
    const islandVisible = configured && !loading && !user && !islandDismissed;
    return {
      user,
      session,
      loading,
      configured,
      googleClientId: config.googleClientId,
      googleEnabled: config.googleEnabled,
      islandDismissed,
      islandHeight,
      islandVisible,
      signInError,
      setSignInError,
      setIslandHeight,
      dismissIsland,
      revealIsland,
      signOut,
      signInWithGoogleIdToken,
      signInWithGoogleOAuth,
    };
  }, [
    user,
    session,
    loading,
    configured,
    config.googleClientId,
    config.googleEnabled,
    islandDismissed,
    islandHeight,
    signInError,
    dismissIsland,
    revealIsland,
    signOut,
    signInWithGoogleIdToken,
    signInWithGoogleOAuth,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}
