'use client';

import React, { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { hashActivitySet } from '@/lib/activitySetHash';
import {
  createOtherCropProductivityActivities,
  OTHER_CROP_OPTIONS,
  type CropGenerationMode,
  type CropProductivityExercise,
  type OtherCropId,
} from '@/lib/otherCropProductivityGenerator';
import type { StudyAnswer } from '@/lib/agronomyStudy';

const STORAGE_KEY = 'n-simple:other-crops-productivity:last-set-hash';
const modeLabels: Record<CropGenerationMode, string> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
  balanced: 'Equilibrado',
};
const difficultyLabels = ['', 'Básica', 'Intermediária', 'Avançada'];

function parseBrazilianNumber(raw: string): number {
  const value = raw.trim().replace(/\s/g, '');
  if (!value) return Number.NaN;
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : /^\-?\d{1,3}(\.\d{3})+$/.test(value) ? value.replace(/\./g, '') : value;
  return Number(normalized);
}

function answerIsCorrect(answer: StudyAnswer, raw: string): boolean {
  const value = parseBrazilianNumber(raw);
  if (!Number.isFinite(value)) return false;
  const expected = Number(answer.value);
  const tolerance = answer.tolerance ?? Math.max(0.02, Math.abs(expected) * 0.015);
  return Math.abs(value - expected) <= tolerance;
}

const formatValue = (value: string | number) =>
  typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : value;

interface Props {
  onBack?: () => void;
  fixedCrop?: OtherCropId;
}

export default function OtherCropProductivityGenerator({ onBack, fixedCrop }: Props) {
  const [crop, setCrop] = useState<OtherCropId>(fixedCrop ?? 'sorghum');
  React.useEffect(() => { if (fixedCrop) setCrop(fixedCrop); }, [fixedCrop]);
  const [mode, setMode] = useState<CropGenerationMode>('balanced');
  const [count, setCount] = useState('12');
  const [activities, setActivities] = useState<CropProductivityExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hashPreview, setHashPreview] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const lastHashRef = useRef<string | null>(null);

  const current = activities[index] ?? null;
  const correctCount = current
    ? current.answers.filter((answer) => answerIsCorrect(answer, values[answer.key] ?? '')).length
    : 0;
  const allCorrect = !!current && correctCount === current.answers.length;
  const selectedCropName = OTHER_CROP_OPTIONS.find((option) => option.value === crop)?.label ?? 'Cultura';

  const generate = async () => {
    const quantity = Number(count);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      setError('Escolha uma quantidade inteira entre 1 e 100 atividades.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setNotice('');
    setActivities([]);
    setValues({});
    setChecked(false);
    setShowSolution(false);
    setSolvedIds([]);

    let previousHash = lastHashRef.current;
    try {
      previousHash = window.localStorage.getItem(STORAGE_KEY) ?? previousHash;
    } catch {
      setStorageWarning(true);
    }

    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const generated = createOtherCropProductivityActivities({ crop, mode, count: quantity });
        const hash = await hashActivitySet(generated);
        if (hash === previousHash) continue;

        lastHashRef.current = hash;
        try {
          window.localStorage.setItem(STORAGE_KEY, hash);
          setStorageWarning(false);
        } catch {
          setStorageWarning(true);
        }

        setActivities(generated);
        setIndex(0);
        setHashPreview(hash.slice(0, 20));
        setNotice(previousHash
          ? 'Conjunto comparado com o anterior: conteúdo diferente.'
          : 'Primeiro conjunto gerado. O hash foi salvo para a próxima comparação.');
        return;
      }
      setError('O conjunto coincidiu com o anterior após várias tentativas. Gere novamente para obter outra combinação.');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar as atividades.');
    } finally {
      setIsGenerating(false);
    }
  };

  const checkCurrent = () => {
    if (!current || (checked && allCorrect)) return;
    const totalCorrect = current.answers.filter((answer) => answerIsCorrect(answer, values[answer.key] ?? '')).length;
    setChecked(true);
    if (totalCorrect === current.answers.length) {
      setSolvedIds((previous) => previous.includes(current.id) ? previous : [...previous, current.id]);
    }
  };

  const move = (direction: -1 | 1) => {
    setIndex((previous) => Math.min(activities.length - 1, Math.max(0, previous + direction)));
    setValues({});
    setChecked(false);
    setShowSolution(false);
  };

  const cardClass = 'rounded-2xl border border-[#E5E2D9] bg-white dark:border-[#343B30] dark:bg-[#20251E]';
  const mutedClass = 'text-[#777468] dark:text-[#A6A395]';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#2E6F40]/20 bg-[#2E6F40]/10 p-3 text-[#2E6F40] dark:text-[#9CB386]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C897E] dark:text-[#A6A395]">Modo de prática independente</p>
            <h3 className="text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">Gerador de produtividade de outras culturas</h3>
            <p className={'mt-1 text-xs ' + mutedClass}>Exercícios numéricos inéditos, com parâmetros e fórmulas específicos de cada cultura.</p>
          </div>
        </div>
        {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-[#DCD8CC] px-3 py-2 text-sm font-semibold text-[#5A5A40] dark:border-[#454D3F] dark:text-[#C8D1BD]">
          <ArrowLeft className="h-4 w-4" /> Voltar à calculadora
        </button>}
      </div>

      {!current ? (
        <div className={cardClass + ' space-y-5 p-4 sm:p-6'}>
          <div>
            <h4 className="font-bold text-[#454638] dark:text-[#E8E7DF]">Configure sua sequência</h4>
            <p className={'mt-1 text-sm ' + mutedClass}>Selecione a cultura, a dificuldade e a quantidade. O motor gera os dados e calcula o gabarito; não reutiliza questões fixas.</p>
            <p className={'mt-2 text-xs ' + mutedClass}>O navegador guarda somente o hash do último conjunto gerado. Se o próximo conjunto tiver o mesmo conteúdo, a geração é repetida automaticamente.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {!fixedCrop && <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">Cultura</span>
              <select value={crop} disabled={Boolean(fixedCrop)} onChange={(event) => setCrop(event.target.value as OtherCropId)} className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 text-sm text-[#454638] dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]">
                {OTHER_CROP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">Nível de dificuldade</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as CropGenerationMode)} className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 text-sm text-[#454638] dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]">
                <option value="basic">Básico — cálculos diretos</option>
                <option value="intermediate">Intermediário — produtividade e perdas</option>
                <option value="advanced">Avançado — estimativa completa e área total</option>
                <option value="balanced">Equilibrado — mistura dos três níveis</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">Quantidade (1–100)</span>
              <input type="number" min={1} max={100} step={1} value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 text-sm text-[#454638] dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]" />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ['Básico', 'Componentes do rendimento ou extrapolação de parcela.'],
              ['Intermediário', 'Produtividade bruta, perdas e produtividade líquida.'],
              ['Avançado', 'Cálculos encadeados e projeção da produção total em toneladas.'],
              ['Equilibrado', 'Distribuição das atividades entre os três níveis.'],
            ] as const).map(([title, description]) => (
              <div key={title} className="rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-3 dark:border-[#343B30] dark:bg-[#272C24]">
                <p className="text-xs font-bold text-[#454638] dark:text-[#E8E7DF]">{title}</p>
                <p className={'mt-1 text-xs leading-relaxed ' + mutedClass}>{description}</p>
              </div>
            ))}
          </div>

          <button type="button" disabled={isGenerating} onClick={generate} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#245B34] disabled:cursor-wait disabled:opacity-60 dark:bg-[#55764F]">
            <RefreshCw className={'h-4 w-4 ' + (isGenerating ? 'animate-spin' : '')} />
            {isGenerating ? 'Gerando e comparando...' : 'Gerar atividades aleatórias'}
          </button>
          {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
          {storageWarning && <p className={'text-xs ' + mutedClass}>O armazenamento local está indisponível. A comparação continuará apenas durante esta sessão.</p>}
        </div>
      ) : (
        <>
          <div className={cardClass + ' flex flex-wrap items-center justify-between gap-3 p-4'}>
            <div>
              <p className="text-xs font-bold text-[#2E6F40] dark:text-[#A8C69A]">{selectedCropName} · {modeLabels[mode]} · {activities.length} atividades</p>
              <p className={'mt-1 text-xs ' + mutedClass}>Conjunto identificado por hash de conteúdo · {hashPreview}…</p>
              {notice && <p className="mt-1 text-xs text-[#2E6F40] dark:text-[#A8C69A]">{notice}</p>}
              {storageWarning && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Comparação persistente indisponível; hash mantido apenas na sessão.</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[#454638] dark:text-[#E8E7DF]">{solvedIds.length}/{activities.length}</p>
              <p className={'text-[10px] ' + mutedClass}>atividades corretas</p>
            </div>
          </div>

          <div className={cardClass + ' space-y-5 p-4 sm:p-6'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#2E6F40]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2E6F40] dark:text-[#A8C69A]">{current.cropName}</span>
                <span className="rounded-full bg-[#D4A373]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9A6A3D] dark:text-[#D4A373]">{difficultyLabels[current.difficulty]}</span>
              </div>
              <span className={'text-xs font-semibold ' + mutedClass}>Atividade {index + 1} de {activities.length}</span>
            </div>

            <div>
              <h4 className="text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">{current.title}</h4>
              <p className={'mt-2 text-sm leading-relaxed ' + mutedClass}>{current.context}</p>
              <p className="mt-3 text-sm font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">{current.prompt}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {current.data.map((item) => (
                <div key={item.label} className="rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] p-3 dark:border-[#343B30] dark:bg-[#272C24]">
                  <p className={'text-[10px] font-semibold uppercase tracking-wide ' + mutedClass}>{item.label}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">{formatValue(item.value)} <span className="text-[10px] font-normal">{item.unit}</span></p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {current.answers.map((answer) => (
                <label key={answer.key} className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">{answer.label} ({answer.unit})</span>
                  <input type="text" inputMode="decimal" autoComplete="off" value={values[answer.key] ?? ''} disabled={checked && allCorrect} onChange={(event) => { setValues((previous) => ({ ...previous, [answer.key]: event.target.value })); setChecked(false); }} placeholder="Digite o resultado" className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 font-mono text-sm text-[#454638] outline-none focus:border-[#2E6F40] dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]" />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={checkCurrent} className="inline-flex items-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-2.5 text-sm font-semibold text-white dark:bg-[#55764F]"><CheckCircle2 className="h-4 w-4" /> Conferir</button>
              <button type="button" onClick={() => setShowSolution((previous) => !previous)} className="rounded-xl border border-[#DCD8CC] px-4 py-2.5 text-sm font-semibold text-[#5A5A40] dark:border-[#454D3F] dark:text-[#C8D1BD]">{showSolution ? 'Ocultar resolução' : 'Ver resolução'}</button>
              <button type="button" onClick={() => { setActivities([]); setIndex(0); setValues({}); setChecked(false); setShowSolution(false); }} className="rounded-xl border border-[#DCD8CC] px-4 py-2.5 text-sm font-semibold text-[#777468] dark:border-[#454D3F] dark:text-[#A6A395]">Alterar parâmetros</button>
            </div>

            {checked && (
              <div role="status" className={'rounded-xl border p-3 text-sm ' + (allCorrect ? 'border-[#2E6F40]/30 bg-[#2E6F40]/10 text-[#2E6F40] dark:text-[#B7D2AA]' : 'border-[#D4A373]/40 bg-[#D4A373]/10 text-[#8D5B2E] dark:text-[#E7B986]')}>
                <p className="font-semibold">{allCorrect ? 'Todos os resultados estão corretos.' : 'Existem resultados para revisar.'}</p>
                <p className="mt-1 text-xs">{correctCount} de {current.answers.length} respostas corretas.</p>
              </div>
            )}

            {showSolution && (
              <div className="rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] p-4 dark:border-[#454D3F] dark:bg-[#272C24]">
                <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A5A40] dark:text-[#C8D1BD]">Resolução passo a passo</h5>
                <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-[#5E5B50] dark:text-[#C1C0B5]">
                  {current.solution.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}
                </ol>
                <div className="mt-3 border-t border-[#E5E2D9] pt-3 dark:border-[#454D3F]">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Referências técnicas</p>
                  {current.source.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-[11px] text-[#2E6F40] underline dark:text-[#A8C69A]">{url}</a>)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={index === 0} onClick={() => move(-1)} className="inline-flex items-center gap-1 rounded-xl border border-[#DCD8CC] px-3 py-2 text-sm font-semibold text-[#5A5A40] disabled:opacity-40 dark:border-[#454D3F] dark:text-[#C8D1BD]"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <button type="button" disabled={index === activities.length - 1} onClick={() => move(1)} className="inline-flex items-center gap-1 rounded-xl bg-[#2E6F40] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#55764F]">Próxima <ChevronRight className="h-4 w-4" /></button>
          </div>
        </>
      )}
    </div>
  );
}
