'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionTema } from '@/lib/tutor/types';
import type {
  Dificuldade,
  MapaMentalPayload,
  PlanoPayload,
  ReviewKind,
  ResumoPayload,
  SeminarioPayload,
  SimuladoPayload,
} from '@/lib/tutor/review';

interface ReviewStudioProps {
  tema?: SessionTema | null;
  userId?: string | null;
}

interface ReviewResultDto {
  kind: ReviewKind;
  topic: string;
  payload: unknown;
  artifactId: string | null;
  flashcardIds?: string[];
  fonte: string;
}

interface FlashcardDto {
  id: string;
  front: string;
  back: string;
  topic: string;
  due_at: string;
  interval_days: number;
  reps: number;
}

const KINDS: Array<{
  id: ReviewKind;
  label: string;
  icon: React.ReactNode;
  hint: string;
  hasQuantidade?: boolean;
}> = [
  { id: 'simulado', label: 'Simulado', icon: <ClipboardList className="size-3.5" />, hint: 'Questões com correção', hasQuantidade: true },
  { id: 'quiz', label: 'Quiz rápido', icon: <Zap className="size-3.5" />, hint: 'Perguntas relâmpago', hasQuantidade: true },
  { id: 'flashcards', label: 'Flashcards', icon: <Layers className="size-3.5" />, hint: 'Repetição espaçada', hasQuantidade: true },
  { id: 'resumo', label: 'Resumo', icon: <BookOpen className="size-3.5" />, hint: 'Material de revisão' },
  { id: 'plano', label: 'Plano de estudos', icon: <CalendarDays className="size-3.5" />, hint: '7 dias organizados' },
  { id: 'mapa_mental', label: 'Mapa mental', icon: <GitBranch className="size-3.5" />, hint: 'Ramos e sub-ramos' },
  { id: 'seminario', label: 'Seminário', icon: <Presentation className="size-3.5" />, hint: 'Roteiro com tempos' },
];

const DIFICULDADES: Array<{ id: Dificuldade; label: string }> = [
  { id: 'facil', label: 'Fácil' },
  { id: 'media', label: 'Média' },
  { id: 'dificil', label: 'Difícil' },
];

function isSimulado(payload: unknown): payload is SimuladoPayload {
  return !!payload && Array.isArray((payload as SimuladoPayload).questoes);
}

async function fetchDueCards(userId?: string | null): Promise<FlashcardDto[]> {
  try {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}&due=1` : '?due=1';
    const res = await fetch(`/api/tutor/flashcards${qs}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { cards?: FlashcardDto[] };
    return data.cards ?? [];
  } catch {
    return [];
  }
}

export default function ReviewStudio({ tema, userId }: ReviewStudioProps) {
  const [kind, setKind] = useState<ReviewKind>('simulado');
  const [temaInput, setTemaInput] = useState('');
  const [subtemaInput, setSubtemaInput] = useState('');
  const [temaEdited, setTemaEdited] = useState(false);
  const [subtemaEdited, setSubtemaEdited] = useState(false);
  const [quantidade, setQuantidade] = useState(10);
  const [dificuldade, setDificuldade] = useState<Dificuldade>('media');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResultDto | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // quiz/simulado — respostas por questão (índice escolhido)
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // flashcards
  const [cards, setCards] = useState<FlashcardDto[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardStats, setCardStats] = useState({ bom: 0, ruim: 0 });

  // segue a sessão atual até o usuário editar manualmente (sem effect)
  const temaValue = temaEdited ? temaInput : tema?.tema || '';
  const subtemaValue = subtemaEdited ? subtemaInput : tema?.subtema || '';

  useEffect(() => {
    void fetchDueCards(userId).then((list) => {
      setCards(list);
      setCardIndex(0);
      setCardRevealed(false);
    });
  }, [userId]);

  const selectedKIND = useMemo(() => KINDS.find((k) => k.id === kind), [kind]);
  const showQuantidade = !!selectedKIND?.hasQuantidade;

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ kind });
      if (userId) qs.set('userId', userId);
      const res = await fetch(`/api/tutor/review?${qs.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        artifacts?: Array<{
          id: string;
          kind: ReviewKind;
          topic: string | null;
          payload: Record<string, unknown>;
        }>;
      };
      const artifact = data.artifacts?.[0];
      if (!artifact) {
        setError('Nenhum material salvo deste tipo ainda.');
        setResult(null);
        return;
      }
      setAnswers({});
      setResult({
        kind: artifact.kind,
        topic: artifact.topic ?? '',
        payload: artifact.payload,
        artifactId: artifact.id,
        fonte: (artifact.payload.fonte as string) ?? 'tema',
      });
      setSavedNote('Carregado do último salvo na nuvem.');
    } catch {
      setError('Falha de rede ao carregar o material salvo.');
    } finally {
      setLoading(false);
    }
  }, [kind, userId]);

  const generate = useCallback(async () => {
    const t = temaValue.trim();
    if (!t) {
      setError('Informe o tema da revisão.');
      return;
    }
    setLoading(true);
    setError(null);
    setSavedNote(null);
    setAnswers({});
    try {
      const res = await fetch('/api/tutor/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          tema: t,
          subtema: subtemaValue.trim() || undefined,
          quantidade,
          dificuldade,
          userId: userId ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        result?: ReviewResultDto;
        error?: string;
      };
      if (!res.ok || !data.result) {
        setError(data.error || 'Falha ao gerar a revisão. Tente novamente.');
        setResult(null);
      } else {
        setResult(data.result);
        setSavedNote(
          data.result.kind === 'flashcards'
            ? data.result.flashcardIds && data.result.flashcardIds.length > 0
              ? `${data.result.flashcardIds.length} flashcards salvos para revisão espaçada.`
              : 'Flashcards gerados (não foi possível salvar na nuvem).'
            : data.result.artifactId
              ? 'Artefato salvo na nuvem.'
              : 'Gerado — nuvem indisponível (modo local).'
        );
        if (data.result.kind === 'flashcards') {
          const list = await fetchDueCards(userId);
          setCards(list);
          setCardIndex(0);
          setCardRevealed(false);
          setCardStats({ bom: 0, ruim: 0 });
        }
      }
    } catch {
      setError('Falha de rede ao gerar a revisão.');
    } finally {
      setLoading(false);
    }
  }, [kind, temaValue, subtemaValue, quantidade, dificuldade, userId]);

  const answerQuestion = useCallback((qIndex: number, altIndex: number) => {
    setAnswers((prev) => (qIndex in prev ? prev : { ...prev, [qIndex]: altIndex }));
  }, []);

  const rateCard = useCallback(
    async (quality: 'bom' | 'ruim' | 'facil') => {
      const card = cards[cardIndex];
      if (!card || cardBusy) return;
      setCardBusy(true);
      try {
        await fetch('/api/tutor/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', id: card.id, quality }),
        });
        setCardStats((s) => ({
          bom: s.bom + (quality === 'ruim' ? 0 : 1),
          ruim: s.ruim + (quality === 'ruim' ? 1 : 0),
        }));
        const next = cardIndex + 1;
        if (next < cards.length) {
          setCardIndex(next);
          setCardRevealed(false);
        } else {
          const list = await fetchDueCards(userId);
          setCards(list);
          setCardIndex(0);
          setCardRevealed(false);
        }
      } catch {
        // mantém o card atual
      } finally {
        setCardBusy(false);
      }
    },
    [cards, cardIndex, cardBusy, userId]
  );

  // ── renderização dos resultados ──

  const renderQuestions = useMemo(() => {
    if (!result || !isSimulado(result.payload)) return null;
    const payload = result.payload;
    const total = payload.questoes.length;
    const correct = payload.questoes.reduce(
      (acc, q, i) => acc + (answers[i] === q.correta ? 1 : 0),
      0
    );
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">
            {payload.titulo}
          </p>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386] font-medium">
            {answeredCount > 0 ? `${correct}/${answeredCount} corretas` : `${total} questões`}
            {` · ${payload.fonte === 'documento' ? 'do seu material' : payload.fonte === 'misto' ? 'material + modelo' : 'sobre o tema'}`}
          </span>
        </div>

        {payload.questoes.map((q, qi) => {
          const chosen = answers[qi];
          const revealed = chosen !== undefined;
          return (
            <div
              key={qi}
              className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] font-medium leading-relaxed">
                  <span className="text-[#8C897E] dark:text-[#9EA399] font-normal mr-1.5">
                    {qi + 1}.
                  </span>
                  {q.enunciado}
                </p>
                <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-md bg-[#F3F1EC] dark:bg-[#2C3328] text-[#8C897E] dark:text-[#9EA399]">
                  {q.dificuldade === 'facil' ? 'fácil' : q.dificuldade === 'dificil' ? 'difícil' : 'média'}
                </span>
              </div>
              <div className="grid gap-1.5">
                {q.alternativas.map((alt, ai) => {
                  const isChosen = chosen === ai;
                  const isCorrect = ai === q.correta;
                  let cls =
                    'border-[#E5E2D9] dark:border-[#3A4235] bg-[#F3F1EC]/50 dark:bg-[#2C3328]/50 text-[#242A20] dark:text-[#F3F1EC] hover:border-[#2E6F40]/40';
                  if (revealed && isCorrect) {
                    cls = 'border-[#2E6F40] bg-[#2E6F40]/10 text-[#245A33] dark:border-[#9CB386] dark:bg-[#9CB386]/15 dark:text-[#C7D9B8]';
                  } else if (revealed && isChosen && !isCorrect) {
                    cls = 'border-red-400 bg-red-500/10 text-red-700 dark:text-red-400';
                  }
                  return (
                    <button
                      key={ai}
                      type="button"
                      onClick={() => answerQuestion(qi, ai)}
                      disabled={revealed}
                      className={cn(
                        'flex items-start gap-2 text-left text-xs px-3 py-2 rounded-xl border transition-colors text-left disabled:cursor-default',
                        cls
                      )}
                    >
                      <span className="font-bold shrink-0">
                        {String.fromCharCode(65 + ai)}
                      </span>
                      <span className="flex-1">{alt}</span>
                      {revealed && isCorrect && (
                        <CheckCircle2 className="size-4 shrink-0 text-[#2E6F40] dark:text-[#9CB386]" />
                      )}
                      {revealed && isChosen && !isCorrect && (
                        <XCircle className="size-4 shrink-0 text-red-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              {revealed && q.explicacao && (
                <p className="text-[11px] text-[#5A5A40] dark:text-[#9EA399] leading-relaxed border-l-2 border-[#D4A373]/50 pl-2.5">
                  {q.explicacao}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [result, answers, answerQuestion]);

  const renderResumo = useMemo(() => {
    if (!result || result.kind !== 'resumo') return null;
    const p = result.payload as ResumoPayload;
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">{p.titulo}</p>
        {p.topicoSumario && (
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] leading-relaxed italic">
            {p.topicoSumario}
          </p>
        )}
        <div className="space-y-2.5">
          {p.topicos.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 space-y-1.5"
            >
              <p className="text-xs font-bold text-[#2E6F40] dark:text-[#9CB386] uppercase tracking-wide">
                {t.titulo}
              </p>
              <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] leading-relaxed">
                {t.texto}
              </p>
            </div>
          ))}
        </div>
        {p.conceitosChave.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]">
              Conceitos-chave
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.conceitosChave.map((c, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#D4A373]/15 text-[#C19262] dark:text-[#E0A96D] border border-[#D4A373]/30"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [result]);

  const renderPlano = useMemo(() => {
    if (!result || result.kind !== 'plano') return null;
    const p = result.payload as PlanoPayload;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">{p.titulo}</p>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386] font-medium">
            {p.duracaoDias} dias
          </span>
        </div>
        {p.meta && (
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] italic">{p.meta}</p>
        )}
        <div className="space-y-2">
          {p.dias.map((d) => (
            <div
              key={d.dia}
              className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 flex gap-3"
            >
              <div className="shrink-0 size-8 rounded-full bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] flex items-center justify-center text-xs font-bold">
                {d.dia}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">
                    {d.foco}
                  </p>
                  <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399] shrink-0">
                    {d.tempoMin} min
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {d.atividades.map((a, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-[#5A5A40] dark:text-[#9EA399] flex gap-1.5"
                    >
                      <span className="text-[#D4A373]">•</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [result]);

  const renderMapa = useMemo(() => {
    if (!result || result.kind !== 'mapa_mental') return null;
    const p = result.payload as MapaMentalPayload;
    const renderNode = (node: { label: string; filhos: unknown[] }, depth: number): React.ReactNode => (
      <li key={depth + node.label} className="space-y-1">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1 border',
            depth === 0
              ? 'bg-[#2E6F40]/10 border-[#2E6F40]/30 text-[#245A33] dark:bg-[#9CB386]/15 dark:border-[#9CB386]/40 dark:text-[#C7D9B8]'
              : depth === 1
                ? 'bg-[#D4A373]/10 border-[#D4A373]/30 text-[#C19262] dark:text-[#E0A96D]'
                : 'bg-[#F3F1EC] border-[#E5E2D9] text-[#5A5A40] dark:bg-[#2C3328] dark:border-[#3A4235] dark:text-[#9EA399]'
          )}
        >
          {node.label}
        </span>
        {node.filhos.length > 0 && (
          <ul className="ml-4 pl-3 border-l border-dashed border-[#D4A373]/40 space-y-1">
            {node.filhos.map((f) =>
              renderNode(f as { label: string; filhos: unknown[] }, Math.min(depth + 1, 2))
            )}
          </ul>
        )}
      </li>
    );
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">{p.titulo}</p>
        <div className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4">
          <ul className="space-y-1.5">
            <li>
              <span className="inline-block text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[#5A5A40] dark:bg-[#9CB386] text-white dark:text-[#1C201A]">
                {p.raiz}
              </span>
            </li>
            <ul className="ml-2 pl-3 border-l-2 border-[#2E6F40]/30 space-y-1.5">
              {p.arvore.map((ramo) => renderNode(ramo, 0))}
            </ul>
          </ul>
        </div>
      </div>
    );
  }, [result]);

  const renderSeminario = useMemo(() => {
    if (!result || result.kind !== 'seminario') return null;
    const p = result.payload as SeminarioPayload;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#242A20] dark:text-[#F3F1EC]">{p.titulo}</p>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D4A373]/15 text-[#C19262] dark:text-[#E0A96D] border border-[#D4A373]/30 font-medium">
            {p.duracaoMin} min
          </span>
        </div>
        {p.objetivo && (
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399] italic">Objetivo: {p.objetivo}</p>
        )}
        <div className="space-y-2">
          {p.itens.map((it, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#2E6F40] dark:text-[#9CB386]">
                  {i + 1}. {it.titulo}
                </p>
                <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399] shrink-0">
                  {it.tempoMin} min
                </span>
              </div>
              <ul className="space-y-0.5">
                {it.pontos.map((pt, j) => (
                  <li
                    key={j}
                    className="text-[11px] text-[#5A5A40] dark:text-[#9EA399] flex gap-1.5"
                  >
                    <span className="text-[#D4A373]">•</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }, [result]);

  const renderFlashcards = useMemo(() => {
    if (!result || result.kind !== 'flashcards') return null;
    if (cards.length === 0) {
      return (
        <div className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 text-center space-y-1">
          <CheckCircle2 className="size-5 mx-auto text-[#2E6F40] dark:text-[#9CB386]" />
          <p className="text-sm text-[#242A20] dark:text-[#F3F1EC] font-medium">
            Nenhum cartão pendente!
          </p>
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399]">
            Gere novos flashcards ou volte mais tarde para revisar.
          </p>
        </div>
      );
    }
    const card = cards[cardIndex];
    if (!card) return null;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386] font-medium">
            Cartão {cardIndex + 1}/{cards.length} · vence {new Date(card.due_at).toLocaleDateString('pt-BR')}
          </span>
          <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
            {cardStats.bom} bom · {cardStats.ruim} para repetir
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCardRevealed((r) => !r)}
          className={cn(
            'w-full rounded-3xl border p-6 min-h-[120px] flex flex-col items-center justify-center gap-2 transition-colors text-center',
            cardRevealed
              ? 'border-[#D4A373]/40 bg-[#D4A373]/10'
              : 'border-[#2E6F40]/30 bg-[#2E6F40]/5 dark:bg-[#9CB386]/10 hover:border-[#2E6F40]/60'
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]">
            {cardRevealed ? 'Resposta' : 'Pergunta'} · {card.topic}
          </span>
          <span
            className={cn(
              'text-sm leading-relaxed',
              cardRevealed
                ? 'text-[#242A20] dark:text-[#F3F1EC]'
                : 'text-[#2E6F40] dark:text-[#9CB386] font-semibold'
            )}
          >
            {cardRevealed ? card.back : card.front}
          </span>
          {!cardRevealed && (
            <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
              Toque para virar
            </span>
          )}
        </button>
        {cardRevealed && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={cardBusy}
              onClick={() => void rateCard('ruim')}
              className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-500/15 disabled:opacity-50"
            >
              Não lembrei
            </button>
            <button
              type="button"
              disabled={cardBusy}
              onClick={() => void rateCard('bom')}
              className="px-3 py-2.5 rounded-xl bg-[#2E6F40] text-white text-xs font-medium hover:bg-[#245A33] disabled:opacity-50"
            >
              Lembrei
            </button>
          </div>
        )}
      </div>
    );
  }, [result, cards, cardIndex, cardRevealed, cardBusy, cardStats, rateCard]);

  const hasResult = !!result;
  const renderResult = () => {
    if (!result) return null;
    if (result.kind === 'simulado' || result.kind === 'quiz') return renderQuestions;
    if (result.kind === 'resumo') return renderResumo;
    if (result.kind === 'plano') return renderPlano;
    if (result.kind === 'mapa_mental') return renderMapa;
    if (result.kind === 'seminario') return renderSeminario;
    if (result.kind === 'flashcards') return renderFlashcards;
    return null;
  };

  return (
    <div id="tutor_review_studio" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#242A20] dark:text-[#F3F1EC]">
          Estúdio de revisão
        </p>
        <span className="text-[10px] text-[#8C897E] dark:text-[#9EA399]">
          usa seu material enviado como fonte primária
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {KINDS.map(({ id, label, icon, hint }) => {
          const active = kind === id;
          return (
            <button
              key={id}
              type="button"
              id={`tutor_review_kind_${id}`}
              onClick={() => {
                setKind(id);
                setResult(null);
                setError(null);
              }}
              title={hint}
              className={cn(
                'flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left transition-colors',
                active
                  ? 'bg-[#2E6F40] dark:bg-[#9CB386] border-[#2E6F40] dark:border-[#9CB386] text-white dark:text-[#1C201A]'
                  : 'bg-white dark:bg-[#1C201A] border-[#E5E2D9] dark:border-[#2C3328] text-[#5A5A40] dark:text-[#9EA399] hover:border-[#2E6F40]/40'
              )}
              aria-pressed={active}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                {icon}
                {label}
              </span>
              <span
                className={cn(
                  'text-[9px] leading-tight',
                  active ? 'text-white/80 dark:text-[#1C201A]/70' : 'text-[#8C897E] dark:text-[#9EA399]'
                )}
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="tutor_review_tema"
              className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]"
            >
              Tema
            </label>
            <input
              id="tutor_review_tema"
              value={temaValue}
              onChange={(e) => {
                setTemaEdited(true);
                setTemaInput(e.target.value);
              }}
              placeholder="ex: Fertilidade do Solo"
              className="w-full text-sm px-3 py-2 rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] bg-[#F3F1EC]/60 dark:bg-[#2C3328]/60 text-[#242A20] dark:text-[#F3F1EC] placeholder:text-[#8C897E] focus:outline-none focus:border-[#2E6F40]/60"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="tutor_review_subtema"
              className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]"
            >
              Subtema (opcional)
            </label>
            <input
              id="tutor_review_subtema"
              value={subtemaValue}
              onChange={(e) => {
                setSubtemaEdited(true);
                setSubtemaInput(e.target.value);
              }}
              placeholder="ex: Calagem"
              className="w-full text-sm px-3 py-2 rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] bg-[#F3F1EC]/60 dark:bg-[#2C3328]/60 text-[#242A20] dark:text-[#F3F1EC] placeholder:text-[#8C897E] focus:outline-none focus:border-[#2E6F40]/60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {showQuantidade && (
            <div className="space-y-1">
              <label
                htmlFor="tutor_review_qtd"
                className="text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]"
              >
                Quantidade
              </label>
              <input
                id="tutor_review_qtd"
                type="number"
                min={1}
                max={20}
                value={quantidade}
                onChange={(e) =>
                  setQuantidade(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-20 text-sm px-3 py-2 rounded-xl border border-[#E5E2D9] dark:border-[#3A4235] bg-[#F3F1EC]/60 dark:bg-[#2C3328]/60 text-[#242A20] dark:text-[#F3F1EC] focus:outline-none focus:border-[#2E6F40]/60"
              />
            </div>
          )}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8C897E] dark:text-[#9EA399]">
              Dificuldade
            </span>
            <div className="flex gap-1">
              {DIFICULDADES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDificuldade(d.id)}
                  className={cn(
                    'text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                    dificuldade === d.id
                      ? 'bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] border-[#2E6F40] dark:border-[#9CB386]'
                      : 'bg-[#F3F1EC] dark:bg-[#2C3328] text-[#5A5A40] dark:text-[#9EA399] border-[#E5E2D9] dark:border-[#3A4235]'
                  )}
                  aria-pressed={dificuldade === d.id}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {kind !== 'flashcards' && (
            <button
              type="button"
              id="tutor_review_load_latest"
              onClick={() => void loadLatest()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#1C201A] border border-[#E5E2D9] dark:border-[#3A4235] text-[#5A5A40] dark:text-[#9EA399] text-xs font-medium hover:border-[#2E6F40]/40 disabled:opacity-50 transition-colors"
            >
              <BookOpen className="size-3.5" />
              Último salvo
            </button>
          )}

          <button
            type="button"
            id="tutor_review_generate"
            onClick={() => void generate()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E6F40] dark:bg-[#9CB386] text-white dark:text-[#1C201A] text-xs font-semibold hover:bg-[#245A33] dark:hover:bg-[#8AB87A] disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Gerando…
              </>
            ) : hasResult ? (
              <>
                <RefreshCw className="size-3.5" />
                Gerar novamente
              </>
            ) : (
              <>
                <SparklesIcon />
                Gerar {selectedKIND?.label.toLowerCase()}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2">
            <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {savedNote && !error && (
          <div className="rounded-xl border border-[#2E6F40]/25 bg-[#2E6F40]/5 px-3 py-2">
            <p className="text-[11px] text-[#245A33] dark:text-[#9CB386]">{savedNote}</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-5 animate-spin text-[#2E6F40] dark:text-[#9CB386]" />
          <p className="text-xs text-[#5A5A40] dark:text-[#9EA399]">
            Lendo seu material e gerando {selectedKIND?.label.toLowerCase()}…
          </p>
        </div>
      )}

      {!loading && result && <div className="space-y-3">{renderResult()}</div>}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" />
    </svg>
  );
}
