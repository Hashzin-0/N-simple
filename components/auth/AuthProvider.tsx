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

  // Merge uma vez por sessão: progresso local → nuvem com user.id
  useEffect(() => {
    if (!user?.id || mergedForUser.current === user.id) return;
    mergedForUser.current = user.id;
    let cancelled = false;

    const pushAll = async () => {
      try {
        const rawTutor = localStorage.getItem('tutor_progress_v1');
        if (rawTutor) {
          const entries = JSON.parse(rawTutor) as Record<
            string,
            {
              topic: string;
              attempts: number;
              strengths: string[];
              weaknesses: string[];
              masteryEstimate: number;
              lastReview: string;
            }
          >;
          for (const entry of Object.values(entries)) {
            if (!entry?.topic) continue;
            await fetch('/api/tutor/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                attempt: {
                  userId: user.id,
                  topic: entry.topic,
                  answerText: '(progresso local migrado)',
                  evaluation: {
                    statusGeral:
                      (entry.masteryEstimate ?? 0) >= 0.8
                        ? 'dominou'
                        : (entry.masteryEstimate ?? 0) >= 0.4
                          ? 'parcial'
                          : 'revisar',
                    conceitosCorretos: entry.strengths || [],
                    omissoes: entry.weaknesses || [],
                    errosConceituais: [],
                    pista: null,
                  } as never,
                  modo: null,
                },
              }),
            }).catch(() => undefined);
          }
        }

        const rawLibras = localStorage.getItem('libras_progress_v1');
        if (rawLibras) {
          const map = JSON.parse(rawLibras) as Record<
            string,
            { learned: boolean; quizScore: number }
          >;
          const entries = Object.entries(map).map(([wordId, v]) => ({
            word_id: wordId,
            learned: Boolean(v.learned),
            quiz_score: Number(v.quizScore) || 0,
            module_id: 'migrated',
          }));
          if (entries.length) {
            await fetch('/api/libras/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, entries }),
            }).catch(() => undefined);
          }
        }
      } catch {
        /* merge best-effort */
      }
      if (cancelled) return;
    };

    void pushAll();
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
