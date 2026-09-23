'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence } from 'motion/react';
import { CloudOff, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { getBrowserSupabase } from '@/lib/supabaseBrowser';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

async function generateNonce(): Promise<{ nonce: string; hashedNonce: string }> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const encoded = new TextEncoder().encode(nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { nonce, hashedNonce };
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export default function GoogleSignInIsland() {
  const {
    islandVisible,
    googleClientId,
    googleEnabled,
    signInWithGoogleIdToken,
    signInWithGoogleOAuth,
    dismissIsland,
    setIslandHeight,
    signInError,
    setSignInError,
  } = useAuth();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const nonceRef = useRef<{ nonce: string; hashedNonce: string } | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const useGis = Boolean(googleClientId);

  // Mede altura da ilha → HUD de voz sobe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setIslandHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setIslandHeight(0);
    };
  }, [setIslandHeight, islandVisible, gisReady, useGis]);

  const handleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) return;
      setBusy(true);
      setSignInError(null);
      try {
        await signInWithGoogleIdToken(
          response.credential,
          nonceRef.current?.nonce
        );
      } catch {
        // erro já setado no provider
      } finally {
        setBusy(false);
      }
    },
    [signInWithGoogleIdToken, setSignInError]
  );

  // Callback GIS precisa existir no escopo global
  useEffect(() => {
    if (!islandVisible || !useGis) return;
    (window as unknown as Record<string, unknown>).__nproHandleGoogleCredential = (
      response: { credential?: string }
    ) => {
      void handleCredential(response);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__nproHandleGoogleCredential;
    };
  }, [handleCredential, islandVisible, useGis]);

  const initGis = useCallback(async () => {
    if (!googleClientId || !window.google?.accounts?.id || !buttonRef.current) return;
    if (!nonceRef.current) {
      nonceRef.current = await generateNonce();
    }
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response: { credential?: string }) => {
        void handleCredential(response);
      },
      nonce: nonceRef.current.hashedNonce,
      use_fedcm_for_prompt: true,
      locale: 'pt-Br',
      context: 'signin',
    });
    buttonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      shape: 'pill',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      logo_alignment: 'left',
      locale: 'pt-BR',
      width: 220,
    });
    setGisReady(true);
  }, [googleClientId, handleCredential]);

  useEffect(() => {
    if (!islandVisible || !useGis || !gisReady) return;
    // reinit quando callback/nonce mudam (renderButton exige initialize prévio)
    void initGis();
  }, [islandVisible, useGis, gisReady, initGis]);

  const handleOAuthFallback = useCallback(async () => {
    setBusy(true);
    setSignInError(null);
    try {
      await signInWithGoogleOAuth();
    } catch {
      /* setado no provider */
    } finally {
      setBusy(false);
    }
  }, [signInWithGoogleOAuth, setSignInError]);

  if (!islandVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        id="google_signin_island"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4"
        role="region"
        aria-label="Entrar com Google"
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white/95 dark:bg-[#1C201A]/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.12)] px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <CloudOff className="size-4 text-[#8C897E] dark:text-[#9EA399] shrink-0 mt-0.5" />
              <div className="min-w-0 text-left">
                <p className="text-xs sm:text-[13px] font-semibold text-[#242A20] dark:text-[#F3F1EC]">
                  Entrar para salvar seu progresso na nuvem
                </p>
                <p className="text-[11px] text-[#8C897E] dark:text-[#9EA399] leading-snug mt-0.5">
                  Sem login, tudo fica{' '}
                  <strong className="font-semibold text-[#5A5A40] dark:text-[#C5D9B0]">
                    só neste dispositivo
                  </strong>{' '}
                  e pode ser perdido se você limpar os dados do navegador.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              {useGis ? (
                <div
                  ref={buttonRef}
                  id="g_signin_button"
                  className="min-h-[40px] min-w-[180px] flex items-center justify-center"
                  aria-label="Entrar com Google"
                />
              ) : (
                <button
                  type="button"
                  id="btn_oauth_google"
                  onClick={() => void handleOAuthFallback()}
                  disabled={busy || !googleEnabled}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E5E2D9] dark:border-[#3A4235] bg-white dark:bg-[#242720] px-4 py-2 text-sm font-medium text-[#3D3D3D] dark:text-[#E8E6DF] hover:bg-[#F9F8F6] dark:hover:bg-[#2C3328] transition-colors disabled:opacity-50"
                >
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Entrar com Google
                </button>
              )}

              <button
                type="button"
                id="btn_dismiss_signin_island"
                onClick={dismissIsland}
                className="p-1.5 rounded-full text-[#8C897E] dark:text-[#9EA399] hover:bg-[#F0EDE5] dark:hover:bg-[#242720] transition-colors"
                title="Continuar anônimo"
                aria-label="Continuar anônimo"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

        {signInError && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400" role="alert">
            {signInError}
          </p>
        )}
        </div>

        {useGis && (
          <Script
            src={GIS_SRC}
            strategy="afterInteractive"
            onLoad={() => {
              setGisReady(true);
              void initGis();
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
