'use client';

import React, { useState } from 'react';
import { BookCopy, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { ResearchQuestionsResponse, SessionTema } from '@/lib/tutor/types';

interface ResearchPanelProps {
  tema: SessionTema | null;
}

export default function ResearchPanel({ tema }: ResearchPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchQuestionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResearch = async () => {
    if (!tema || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tutor/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: tema.tema, subtema: tema.subtema }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as ResearchQuestionsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na pesquisa de questões.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="tutor_research"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC] flex items-center gap-1.5">
          <BookCopy className="size-4 text-[#2E6F40] dark:text-[#9CB386]" />
          Banco de questões
        </h3>
        <button
          type="button"
          id="tutor_research_button"
          onClick={handleResearch}
          disabled={!tema || loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] hover:bg-[#454530] dark:hover:bg-[#8AB87A] disabled:opacity-40 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Pesquisando…
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5" />
              Pesquisar questões
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-[#8C897E] dark:text-[#9EA399] leading-relaxed">
        Busca em fontes acadêmicas (ENEM, universidades, materiais de Agronegócio), extrai
        questões estruturadas e salva no Supabase com embedding para reuso nas próximas sessões.
      </p>

      {tema && (
        <p className="text-xs text-[#5A5A40] dark:text-[#9EA399]">
          Tema atual:{' '}
          <span className="font-medium text-[#242A20] dark:text-[#F3F1EC]">
            {tema.tema}
            {tema.subtema ? ` — ${tema.subtema}` : ''}
          </span>
        </p>
      )}

      {!tema && (
        <p className="text-xs text-[#8C897E] dark:text-[#9EA399] italic">
          Escolha um tema na seção acima para habilitar a pesquisa.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl p-3 bg-[#2E6F40]/5 border border-[#2E6F40]/15 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#2E6F40] dark:text-[#9CB386] shrink-0 mt-0.5" />
            <div className="text-xs text-[#242A20] dark:text-[#F3F1EC] space-y-1">
              <p className="font-medium">
                {result.decision === 'reuse'
                  ? 'Reuso da memória acadêmica'
                  : result.decision === 'unavailable'
                    ? 'Supabase indisponível'
                    : 'Nova pesquisa concluída'}
              </p>
              <p className="text-[#5A5A40] dark:text-[#9EA399]">{result.message}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386]">
                  {result.questions.length} questões
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4A373]/15 text-[#C19262] dark:text-[#E0A96D]">
                  {result.reusedCount} reaproveitadas
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A5A40]/10 text-[#5A5A40] dark:bg-[#9CB386]/10 dark:text-[#9CB386]">
                  {result.researchedCount} pesquisadas
                </span>
                {(result.artigoCount ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2E6F40]/15 text-[#2E6F40] dark:bg-[#86efac]/15 dark:text-[#86efac]">
                    {result.artigoCount} de artigos
                  </span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399]">
                  {result.generatedCount} geradas
                </span>
              </div>
              {result.errors.length > 0 && (
                <p className="text-[11px] text-[#C19262] dark:text-[#E0A96D] pt-1">
                  {result.errors.slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
