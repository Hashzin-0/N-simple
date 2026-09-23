'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence } from 'motion/react';
import { CloudOff, X } from 'lucide-react';
import { useAuth } from './AuthProvider';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (
            cb?: (notification: {
              isDisplayedMoment: () => boolean;
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              isDismissedMoment: () => boolean;
              getDismissedReason: () => string;
              getNotDisplayedReason: () => string;
              getSkippedReason: () => string;
            }) => void
          ) => void;
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
const PROMPT_FALLBACK_MS = 3500;

type PromptOutcome = 'waiting' | 'onetap' | 'fallback';

async function initializeGis(
  clientId: string,
  onCredential: (r: { credential?: string }) => void
): Promise<boolean> {
  if (!window.google?.accounts?.id) return false;
  const { hashedNonce } = await generateNonce();
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: onCredential,
    nonce: hashedNonce,
    use_fedcm_for_prompt: true,
    locale: 'pt-BR',
    context: 'signin',
  });
  return true;
}

function renderGisButton(el: HTMLElement) {
  if (!window.google?.accounts?.id) return;
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    shape: 'pill',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    logo_alignment: 'left',
    locale: 'pt-BR',
    width: 220,
  });
}

/**
 * One Tap quando visível e deslogado. Se o prompt não aparecer → barra no rodapé.
 * Desmonta com islandVisible=false → estado reseta (logado/dismiss).
 */
function SignInIslandInner({
  clientId,
  googleEnabled,
  gisAvailable,
  onIdToken,
  onOAuth,
  onDismiss,
  onError,
  onHeight,
  signInError,
}: {
  clientId: string | null;
  googleEnabled: boolean;
  gisAvailable: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onOAuth: () => Promise<void>;
  onDismiss: () => void;
  onError: (msg: string | null) => void;
  onHeight: (h: number) => void;
  signInError: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const promptStartedRef = useRef(false);
  const handleCredentialRef = useRef<((r: { credential?: string }) => void) | null>(null);
  const [outcome, setOutcome] = useState<PromptOutcome>('waiting');
  const [busy, setBusy] = useState(false);

  const hasClientId = Boolean(clientId);
  const gisButtonUsable = hasClientId && gisAvailable && outcome === 'fallback';

  const handleCredential = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) return;
      setBusy(true);
      onError(null);
      try {
        await onIdToken(response.credential);
      } catch {
        // erro já setado no provider
      } finally {
        setBusy(false);
      }
    },
    [onIdToken, onError]
  );

  useEffect(() => {
    handleCredentialRef.current = (response: { credential?: string }) => {
      void handleCredential(response);
    };
  }, [handleCredential]);

  // One Tap: só callbacks/timeout fazem setState (lint set-state-in-effect)
  useEffect(() => {
    if (!hasClientId || !gisAvailable) return;
    if (promptStartedRef.current) return;
    promptStartedRef.current = true;

    const timeoutId = window.setTimeout(() => {
      setOutcome((o) => (o === 'waiting' ? 'fallback' : o));
    }, PROMPT_FALLBACK_MS);

    void (async () => {
      if (!clientId || !window.google?.accounts?.id) {
        setOutcome('fallback');
        return;
      }
      const ok = await initializeGis(clientId, (r) => {
        handleCredentialRef.current?.(r);
      });
      if (!ok || !window.google?.accounts?.id) {
        setOutcome('fallback');
        return;
      }
      window.google.accounts.id.prompt((notification) => {
        if (notification.isDisplayedMoment()) {
          setOutcome('onetap');
          return;
        }
        setOutcome('fallback');
      });
    })();

    return () => window.clearTimeout(timeoutId);
  }, [hasClientId, gisAvailable, clientId]);

  // Botão GIS no fallback
  useEffect(() => {
    if (outcome !== 'fallback' || !gisButtonUsable || !buttonRef.current || !clientId) return;
    const el = buttonRef.current;
    void (async () => {
      const ok = await initializeGis(clientId, (r) => {
        handleCredentialRef.current?.(r);
      });
      if (ok) renderGisButton(el);
    })();
  }, [outcome, gisButtonUsable, clientId]);

  // Mede barra → HUD (ResizeObserver = external; setState só no callback)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      onHeight(el.offsetHeight);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      onHeight(0);
    };
  }, [outcome, onHeight]);

  const handleOAuth = useCallback(async () => {
    setBusy(true);
    onError(null);
    try {
      await onOAuth();
    } catch {
      /* setado no provider */
    } finally {
      setBusy(false);
    }
  }, [onOAuth, onError]);

  const showFallback =
    outcome === 'fallback' || (!hasClientId && outcome === 'waiting');

  if (outcome === 'onetap') return null;
  if (!showFallback) return null;

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
              {gisButtonUsable ? (
                <div
                  ref={buttonRef}
                  id="g_signin_button"
                  className="min-h-[40px] min-w-[180px] flex items-center justify-center"
                  aria-label="Continuar com Google"
                />
              ) : (
                <button
                  type="button"
                  id="btn_oauth_google"
                  onClick={() => void handleOAuth()}
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
                  Continuar com Google
                </button>
              )}

              <button
                type="button"
                id="btn_dismiss_signin_island"
                onClick={onDismiss}
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
      </motion.div>
    </AnimatePresence>
  );
}

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

  const hasClientId = Boolean(googleClientId);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [gisScriptFailed, setGisScriptFailed] = useState(false);

  const handleIdToken = useCallback(
    async (token: string) => {
      await signInWithGoogleIdToken(token);
    },
    [signInWithGoogleIdToken]
  );

  // GIS pronto ou falhou → pode montar o fluxo (sem setState síncrono: derive)
  const gisAvailable = gisLoaded && !gisScriptFailed;
  const canMountInner = !hasClientId || gisAvailable || gisScriptFailed;
  const innerClientId = gisScriptFailed ? null : googleClientId;

  const script =
    hasClientId && !gisScriptFailed ? (
      <Script
        src={GIS_SRC}
        strategy="afterInteractive"
        onLoad={() => setGisLoaded(true)}
        onError={() => setGisScriptFailed(true)}
      />
    ) : null;

  if (!islandVisible) {
    return script;
  }

  return (
    <>
      {script}
      {canMountInner && (
        <SignInIslandInner
          key="signin-island-inner"
          clientId={innerClientId}
          googleEnabled={googleEnabled}
          gisAvailable={gisAvailable}
          onIdToken={handleIdToken}
          onOAuth={signInWithGoogleOAuth}
          onDismiss={dismissIsland}
          onError={setSignInError}
          onHeight={setIslandHeight}
          signInError={signInError}
        />
      )}
    </>
  );
}
