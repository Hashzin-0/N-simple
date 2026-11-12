'use client';

import React, { useRef, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { hashActivitySet } from '@/lib/activitySetHash';
import { createCornProductivityActivities, type CornGenerationMode, type CornProductivityExercise } from '@/lib/cornProductivityGenerator';
import type { StudyAnswer } from '@/lib/agronomyStudy';

const STORAGE_KEY = 'n-simple:corn-productivity:last-set-hash';
const modeLabels: Record<CornGenerationMode, string> = { basic: 'Básico', intermediate: 'Intermediário', advanced: 'Avançado', balanced: 'Equilibrado' };
const difficultyLabels = ['', 'Básica', 'Intermediária', 'Avançada'];
function parseNumber(raw: string): number {
  const value = raw.trim().replace(/\s/g, '');
  if (!value) return Number.NaN;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : /^\-?\d{1,3}(\.\d{3})+$/.test(value) ? value.replace(/\./g, '') : value;
  return Number(normalized);
}
function isCorrect(answer: StudyAnswer, raw: string): boolean {
  const value = parseNumber(raw);
  if (!Number.isFinite(value)) return false;
  const expected = Number(answer.value);
  return Math.abs(value - expected) <= (answer.tolerance ?? Math.max(0.02, Math.abs(expected) * 0.015));
}
const formatValue = (value: string | number) => typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : value;

export default function CornProductivityGenerator() {
  const [mode, setMode] = useState<CornGenerationMode>('balanced');
  const [count, setCount] = useState('12');
  const [activities, setActivities] = useState<CornProductivityExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const lastHashRef = useRef<string | null>(null);
  const current = activities[index] ?? null;
  const correctCount = current ? current.answers.filter((answer) => isCorrect(answer, values[answer.key] ?? '')).length : 0;

  const generate = async () => {
    const quantity = Number(count);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) { setError('Escolha uma quantidade inteira entre 1 e 100 atividades.'); return; }
    setIsGenerating(true); setError(''); setNotice(''); setActivities([]); setValues({}); setChecked(false); setShowSolution(false); setSolvedIds([]);
    let previousHash = lastHashRef.current;
    try { previousHash = window.localStorage.getItem(STORAGE_KEY) ?? previousHash; } catch { setStorageWarning(true); }
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const generated = createCornProductivityActivities({ mode, count: quantity });
        const hash = await hashActivitySet(generated);
        if (hash === previousHash) continue;
        lastHashRef.current = hash;
        try { window.localStorage.setItem(STORAGE_KEY, hash); setStorageWarning(false); } catch { setStorageWarning(true); }
        setActivities(generated); setIndex(0);
        setNotice(previousHash ? 'Novo conjunto diferente do anterior.' : 'Primeiro conjunto gerado e hash salvo para comparação futura.');
        setIsGenerating(false); return;
      }
      setError('O conjunto coincidiu com o anterior após várias tentativas. Gere novamente.');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar as atividades.');
    } finally { setIsGenerating(false); }
  };
  const checkCurrent = () => {
    if (!current) return;
    setChecked(true);
    if (current.answers.every((answer) => isCorrect(answer, values[answer.key] ?? ''))) setSolvedIds((previous) => previous.includes(current.id) ? previous : [...previous, current.id]);
  };
  const move = (direction: -1 | 1) => {
    setIndex((previous) => Math.min(activities.length - 1, Math.max(0, previous + direction)));
    setValues({}); setChecked(false); setShowSolution(false);
  };
  const cardClass = 'rounded-2xl border border-[#E5E2D9] bg-white dark:border-[#343B30] dark:bg-[#20251E]';
  const mutedClass = 'text-[#777468] dark:text-[#A6A395]';

  return (
    <section id="corn_productivity_activities" className="w-full space-y-4 rounded-3xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 sm:p-6 dark:border-[#343B30] dark:bg-[#1A1E18]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#D4A373]/15 p-3 text-[#A97848] dark:text-[#D4A373]"><BookOpenCheck className="h-6 w-6" /></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C897E] dark:text-[#A6A395]">Prática e avaliação</p><h2 className="text-xl font-bold text-[#454638] dark:text-[#E8E7DF]">Atividades de produtividade de milho</h2><p className="mt-1 text-xs text-[#777468] dark:text-[#A6A395]">Questões numéricas geradas aleatoriamente a partir dos componentes de rendimento, parcelas e perdas de colheita.</p></div>
      </div>
      <div className={cardClass + ' grid gap-3 p-4 sm:grid-cols-[1fr_130px_auto] sm:items-end'}>
        <label className="block text-xs font-semibold text-[#5A5A40] dark:text-[#C7CEBC]">Nível de dificuldade
          <select value={mode} onChange={(event) => setMode(event.target.value as CornGenerationMode)} className="mt-1.5 w-full rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] px-3 py-2.5 text-sm dark:border-[#41483B] dark:bg-[#272C24] dark:text-[#E8E7DF]">{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="block text-xs font-semibold text-[#5A5A40] dark:text-[#C7CEBC]">Quantidade
          <input type="number" min={1} max={100} step={1} value={count} onChange={(event) => setCount(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] px-3 py-2.5 text-sm dark:border-[#41483B] dark:bg-[#272C24] dark:text-[#E8E7DF]" />
        </label>
        <button type="button" disabled={isGenerating} onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5A5A40] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#454530] disabled:opacity-60 dark:bg-[#6E785A] dark:hover:bg-[#7F8C68]"><Sparkles className="h-4 w-4" /> {isGenerating ? 'Gerando...' : 'Gerar atividades'}</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-[#557A91]/20 bg-[#557A91]/[0.06] p-3 text-xs text-[#557A91] dark:text-[#9DC0D2]">{notice}</p>}
      {storageWarning && <p className="text-[10px] text-[#A97848]">O navegador bloqueou o armazenamento local; a comparação de conjuntos vale apenas nesta sessão.</p>}
      {current && <div className={cardClass + ' space-y-5 p-4 sm:p-6'}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-[#D4A373]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9A6A3D] dark:text-[#D4A373]">{difficultyLabels[current.difficulty]}</span><span className="text-xs text-[#777468] dark:text-[#A6A395]">Atividade {index + 1} de {activities.length}</span></div><span className="text-xs font-semibold text-[#2E6F40] dark:text-[#A8C69A]">{solvedIds.length} concluídas</span></div>
        <div><h3 className="text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">{current.title}</h3><p className={'mt-2 text-sm leading-relaxed ' + mutedClass}>{current.context}</p><p className="mt-3 text-sm font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">{current.prompt}</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{current.data.map((item) => <div key={item.label} className="rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-3 dark:border-[#343B30] dark:bg-[#272C24]"><p className={'text-[10px] font-semibold uppercase tracking-wide ' + mutedClass}>{item.label}</p><p className="mt-1 font-mono text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">{formatValue(item.value)} <span className="text-[10px] font-normal">{item.unit}</span></p></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2">{current.answers.map((answer) => <label key={answer.key} className="block text-xs font-semibold text-[#5A5A40] dark:text-[#C7CEBC]">{answer.label} <span className="font-normal text-[#8C897E]">({answer.unit})</span><input type="text" inputMode="decimal" value={values[answer.key] ?? ''} onChange={(event) => { setValues((previous) => ({ ...previous, [answer.key]: event.target.value })); setChecked(false); }} placeholder="Digite sua resposta" className="mt-1.5 w-full rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] px-3 py-2.5 font-mono text-sm dark:border-[#41483B] dark:bg-[#272C24] dark:text-[#E8E7DF]" /></label>)}</div>
        {checked && <div className={'rounded-xl border p-3 text-xs ' + (current.answers.every((answer) => isCorrect(answer, values[answer.key] ?? '')) ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300' : 'border-[#D4A373]/40 bg-[#D4A373]/10 text-[#8A633E] dark:text-[#D4A373]')}>{current.answers.every((answer) => isCorrect(answer, values[answer.key] ?? '')) ? 'Todas as respostas estão corretas.' : correctCount + ' de ' + current.answers.length + ' respostas corretas. Revise os valores ou consulte a resolução.'}</div>}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={checkCurrent} className="inline-flex items-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#245B34]"><CheckCircle2 className="h-4 w-4" /> Corrigir respostas</button><button type="button" onClick={() => setShowSolution((previous) => !previous)} className="inline-flex items-center gap-2 rounded-xl border border-[#E5E2D9] px-4 py-2.5 text-xs font-bold text-[#5A5A40] hover:bg-[#FAF9F5] dark:border-[#41483B] dark:text-[#C7CEBC] dark:hover:bg-[#272C24]"><RefreshCw className="h-4 w-4" /> {showSolution ? 'Ocultar resolução' : 'Ver resolução'}</button></div>
        {showSolution && <div className="space-y-2 rounded-xl border border-[#557A91]/20 bg-[#557A91]/[0.05] p-4 text-xs leading-relaxed dark:bg-[#557A91]/10">{current.solution.map((step, stepIndex) => <p key={stepIndex} className="text-[#5A5A40] dark:text-[#C7CEBC]"><strong>{stepIndex + 1}.</strong> {step}</p>)}</div>}
        <div className="flex flex-wrap gap-2 text-[10px] text-[#8C897E] dark:text-[#A6A395]">{current.source.map((source, sourceIndex) => <a key={source} href={source} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#557A91] dark:hover:text-[#9DC0D2]">Referência técnica {sourceIndex + 1}</a>)}</div>
        <div className="flex items-center justify-between border-t border-[#E5E2D9] pt-4 dark:border-[#343B30]"><button type="button" disabled={index === 0} onClick={() => move(-1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-[#5A5A40] disabled:opacity-40 dark:text-[#C7CEBC]"><ChevronLeft className="h-4 w-4" /> Anterior</button><button type="button" disabled={index === activities.length - 1} onClick={() => move(1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-[#5A5A40] disabled:opacity-40 dark:text-[#C7CEBC]">Próxima <ChevronRight className="h-4 w-4" /></button></div>
      </div>}
    </section>
  );
}
