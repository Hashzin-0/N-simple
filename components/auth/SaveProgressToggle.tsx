'use client';

import React, { useState } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

/**
 * Toggle "Salvar progresso" (Tutor/Libras):
 * - Logado: não renderiza (nuvem sempre ativa com user.id).
 * - Deslogado: alterna a intenção de salvar na nuvem → pede login (revela a ilha).
 * - Sempre deixa claro que o backup local continua e pode ser perdido.
 */
export default function SaveProgressToggle({ id }: { id?: string }) {
  const { user, loading, configured, revealIsland, islandVisible } = useAuth();
  const [wantsCloudState, setWantsCloudState] = useState(false);

  if (loading || !configured || user) return null;
  const wantsCloud = wantsCloudState;

  const handleToggle = () => {
    const next = !wantsCloud;
    setWantsCloudState(next);
    if (next) {
      revealIsland();
    }
  };

  return (
    <div
      id={id}
      className="flex flex-col gap-1.5 rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] px-3.5 py-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {wantsCloud ? (
            <Cloud className="size-4 text-[#2E6F40] dark:text-[#9CB386] shrink-0" />
          ) : (
            <CloudOff className="size-4 text-[#8C897E] dark:text-[#9EA399] shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">
              Salvar progresso
            </p>
            <p className="text-[10px] text-[#8C897E] dark:text-[#9EA399] leading-tight">
              {wantsCloud
                ? 'Faça login com Google para ativar a nuvem.'
                : 'Somente neste dispositivo — pode ser perdido.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={wantsCloud}
          aria-label="Salvar progresso na nuvem"
          onClick={handleToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            wantsCloud ? 'bg-[#2E6F40]' : 'bg-[#C5C2B8] dark:bg-[#3A4235]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              wantsCloud ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
            style={{ left: 0 }}
          />
        </button>
      </div>

      {wantsCloud && islandVisible && (
        <p className="text-[10px] text-[#2E6F40] dark:text-[#9CB386] flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" />
          One Tap ou botão no rodapé → conclua o login com Google.
        </p>
      )}
    </div>
  );
}
