'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, CircleHelp, ClipboardList, GraduationCap, RotateCcw, Shuffle, Sprout } from 'lucide-react';
import {
  createRandomStudyPlan,
  getIndividualStudyExercises,
  type StudyAnswer,
  type StudyExercise,
  type StudyTopic,
} from '@/lib/agronomyStudy';

type TopicFilter = 'todos' | StudyTopic;
type Feedback = { correct: boolean; correctCount: number; total: number };

const topicNames: Record<StudyTopic, string> = {
  soja: 'Produtividade de soja',
  calagem: 'Calagem',
  gessagem: 'Gessagem',
};

const difficultyNames = ['', 'Básica', 'Intermediária', 'Avançada'];

const formatValue = (value: string | number) =>
  typeof value === 'number'
    ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    : value;

function isAnswerCorrect(answer: StudyAnswer, raw: string): boolean {
  if (answer.type === 'choice') return raw.trim().toLowerCase() === String(answer.value).toLowerCase();
  if (!raw.trim()) return false;
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return false;
  return Math.abs(parsed - Number(answer.value)) <= (answer.tolerance ?? Math.max(0.02, Math.abs(Number(answer.value)) * 0.015));
}

export default function SoybeanStudySection() {
  const exercises = useMemo(() => getIndividualStudyExercises(), []);
  const [filter, setFilter] = useState<TopicFilter>('todos');
  const [selected, setSelected] = useState<StudyExercise | null>(null);
  const [plan, setPlan] = useState<StudyExercise[]>([]);
  const [planIndex, setPlanIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [score, setScore] = useState(0);

  const current = selected ?? plan[planIndex] ?? null;
  const isPlan = plan.length > 0;
  const visibleExercises = exercises.filter((exercise) => filter === 'todos' || exercise.topic === filter);

  const resetAttempt = (exercise: StudyExercise | null) => {
    setSelected(exercise);
    setPlan([]);
    setPlanIndex(0);
    setValues({});
    setFeedback(null);
    setShowSolution(false);
    setScore(0);
  };

  const startPlan = () => {
    setPlan(createRandomStudyPlan());
    setSelected(null);
    setPlanIndex(0);
    setValues({});
    setFeedback(null);
    setShowSolution(false);
    setScore(0);
  };

  const startRandomExercise = () => {
    const generated = createRandomStudyPlan();
    const exercise = generated[Math.floor(Math.random() * generated.length)];
    resetAttempt(exercise);
  };

  const checkAnswers = () => {
    if (!current) return;
    const correctCount = current.answers.filter((answer) => isAnswerCorrect(answer, values[answer.key] ?? '')).length;
    const correct = correctCount === current.answers.length;
    setFeedback({ correct, correctCount, total: current.answers.length });
    if (correct && !feedback?.correct) setScore((previous) => previous + 1);
  };

  const nextPlanQuestion = () => {
    if (planIndex >= plan.length - 1) {
      setPlan([]);
      setPlanIndex(0);
      setSelected(null);
      setValues({});
      setFeedback(null);
      setShowSolution(false);
      return;
    }
    setPlanIndex((previous) => previous + 1);
    setValues({});
    setFeedback(null);
    setShowSolution(false);
  };

  const cardClass = 'rounded-2xl border border-[#E5E2D9] bg-white dark:border-[#343B30] dark:bg-[#20251E]';
  const mutedClass = 'text-[#777468] dark:text-[#A6A395]';

  return (
    <section id="soybean_studies" className="w-full space-y-6 border-t border-[#E5E2D9] px-4 py-8 sm:px-6 lg:px-8 dark:border-[#343B30]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#2E6F40]/20 bg-[#2E6F40]/10 p-3 text-[#2E6F40] dark:text-[#9CB386]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8C897E] dark:text-[#A6A395]">Depois da calculadora</p>
            <h2 className="text-xl font-bold text-[#5A5A40] dark:text-[#E8E7DF] sm:text-2xl">Estudos e atividades práticas</h2>
            <p className={'mt-1 text-xs sm:text-sm ' + mutedClass}>Treine cálculos de produtividade, calagem e gessagem com dados de campo.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startPlan}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#245B34] dark:bg-[#55764F] dark:hover:bg-[#486642]"
        >
          <Shuffle className="h-4 w-4" />
          Sortear plano de estudos
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {([
          ['soja', 'Produtividade de soja', 'População, legumes, grãos, PMG, quebra e sacas.', 'text-[#2E6F40]'],
          ['calagem', 'Calagem', 'Saturação por bases, CTC, PRNT e dose de calcário.', 'text-[#B77936]'],
          ['gessagem', 'Gessagem', 'Diagnóstico de subsuperfície, argila e dose de gesso.', 'text-[#557A91]'],
        ] as const).map(([topic, title, description, color]) => (
          <button
            key={topic}
            type="button"
            onClick={() => setFilter(topic)}
            className={cardClass + ' p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ' + (filter === topic ? 'ring-2 ring-[#2E6F40]/50' : '')}
          >
            <div className="mb-2 flex items-center justify-between">
              <Sprout className={'h-5 w-5 ' + color} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C897E] dark:text-[#A6A395]">3 atividades</span>
            </div>
            <h3 className="font-bold text-[#454638] dark:text-[#E8E7DF]">{title}</h3>
            <p className={'mt-1 text-xs leading-relaxed ' + mutedClass}>{description}</p>
          </button>
        ))}
      </div>

      {current ? (
        <div className={cardClass + ' space-y-5 p-4 sm:p-6'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#2E6F40]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2E6F40] dark:text-[#A8C69A]">{topicNames[current.topic]}</span>
              <span className="rounded-full bg-[#D4A373]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9A6A3D] dark:text-[#D4A373]">{difficultyNames[current.difficulty]}</span>
            </div>
            {isPlan && <span className="text-xs font-semibold text-[#777468] dark:text-[#A6A395]">Questão {planIndex + 1} de {plan.length} · {score} concluídas</span>}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#454638] dark:text-[#E8E7DF]">{current.title}</h3>
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
                <span className="mb-1.5 block text-xs font-semibold text-[#5A5A40] dark:text-[#C8D1BD]">{answer.label}{answer.unit ? ' (' + answer.unit + ')' : ''}</span>
                {answer.type === 'choice' ? (
                  <select
                    value={values[answer.key] ?? ''}
                    disabled={feedback?.correct ?? false}
                    onChange={(event) => { setValues((previous) => ({ ...previous, [answer.key]: event.target.value })); setFeedback(null); }}
                    className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 text-sm text-[#454638] outline-none focus:border-[#2E6F40] dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]"
                  >
                    <option value="">Selecione uma resposta</option>
                    {(answer.choices ?? []).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={values[answer.key] ?? ''}
                    disabled={feedback?.correct ?? false}
                    onChange={(event) => { setValues((previous) => ({ ...previous, [answer.key]: event.target.value })); setFeedback(null); }}
                    placeholder="Digite o resultado"
                    className="w-full rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] px-3 py-3 font-mono text-sm text-[#454638] outline-none transition focus:border-[#2E6F40] focus:ring-2 focus:ring-[#2E6F40]/10 dark:border-[#454D3F] dark:bg-[#272C24] dark:text-[#E8E7DF]"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={checkAnswers} className="inline-flex items-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245B34] dark:bg-[#55764F]">
              <CheckCircle2 className="h-4 w-4" /> Conferir respostas
            </button>
            <button type="button" onClick={() => setShowSolution((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-[#DCD8CC] px-4 py-2.5 text-sm font-semibold text-[#5A5A40] hover:bg-[#F5F3EE] dark:border-[#454D3F] dark:text-[#C8D1BD] dark:hover:bg-[#272C24]">
              <CircleHelp className="h-4 w-4" /> {showSolution ? 'Ocultar resolução' : 'Ver resolução'}
            </button>
            <button type="button" onClick={() => resetAttempt(null)} className="inline-flex items-center gap-2 rounded-xl border border-[#DCD8CC] px-4 py-2.5 text-sm font-semibold text-[#777468] hover:bg-[#F5F3EE] dark:border-[#454D3F] dark:text-[#A6A395] dark:hover:bg-[#272C24]">
              <RotateCcw className="h-4 w-4" /> Voltar às atividades
            </button>
          </div>

          {feedback && (
            <div className={'rounded-xl border p-3 text-sm ' + (feedback.correct ? 'border-[#2E6F40]/30 bg-[#2E6F40]/10 text-[#2E6F40] dark:text-[#B7D2AA]' : 'border-[#D4A373]/40 bg-[#D4A373]/10 text-[#8D5B2E] dark:text-[#E7B986]')}>
              <p className="font-semibold">{feedback.correct ? 'Respostas corretas.' : 'Ainda há respostas para corrigir.'}</p>
              <p className="mt-1 text-xs">{feedback.correctCount} de {feedback.total} campos corretos.</p>
              {feedback.correct && isPlan && (
                <button type="button" onClick={nextPlanQuestion} className="mt-3 rounded-lg bg-[#2E6F40] px-3 py-2 text-xs font-semibold text-white dark:bg-[#55764F]">
                  {planIndex === plan.length - 1 ? 'Concluir plano' : 'Próxima questão'}
                </button>
              )}
              {feedback.correct && !isPlan && (
                <button type="button" onClick={startRandomExercise} className="mt-3 rounded-lg bg-[#2E6F40] px-3 py-2 text-xs font-semibold text-white dark:bg-[#55764F]">
                  Sortear outra atividade
                </button>
              )}
            </div>
          )}

          {showSolution && (
            <div className="rounded-xl border border-[#DCD8CC] bg-[#FAF9F5] p-4 dark:border-[#454D3F] dark:bg-[#272C24]">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5A5A40] dark:text-[#C8D1BD]">Resolução passo a passo</h4>
              <ol className="list-inside list-decimal space-y-2 text-xs leading-relaxed text-[#5E5B50] dark:text-[#C1C0B5]">
                {current.solution.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
              <div className="mt-3 border-t border-[#E5E2D9] pt-3 dark:border-[#454D3F]">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8C897E] dark:text-[#A6A395]">Fontes técnicas desta atividade</p>
                {current.source.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[11px] text-[#2E6F40] underline dark:text-[#A8C69A]">{url}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#CFCABB] p-4 dark:border-[#454D3F] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-[#5A5A40] dark:text-[#E8E7DF]">Plano progressivo aleatório</h3>
              <p className={'mt-1 text-xs ' + mutedClass}>9 questões sorteadas: três básicas, três intermediárias e três avançadas, alternando os assuntos.</p>
            </div>
            <button type="button" onClick={startPlan} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2E6F40] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245B34] dark:bg-[#55764F]">
              <Shuffle className="h-4 w-4" /> Iniciar plano
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-bold text-[#5A5A40] dark:text-[#E8E7DF]"><ClipboardList className="h-5 w-5" /> Atividades individuais</h3>
            <div className="flex flex-wrap gap-1.5">
              {(['todos', 'soja', 'calagem', 'gessagem'] as TopicFilter[]).map((topic) => (
                <button key={topic} type="button" onClick={() => setFilter(topic)} className={'rounded-full px-3 py-1.5 text-[11px] font-semibold transition ' + (filter === topic ? 'bg-[#2E6F40] text-white dark:bg-[#55764F]' : 'border border-[#DCD8CC] text-[#777468] dark:border-[#454D3F] dark:text-[#B7B5A8]')}>
                  {topic === 'todos' ? 'Todas' : topicNames[topic]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleExercises.map((exercise) => (
              <button key={exercise.id} type="button" onClick={() => resetAttempt(exercise)} className={cardClass + ' group p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md'}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#2E6F40] dark:text-[#A8C69A]">{topicNames[exercise.topic]}</span>
                  <span className="rounded-full bg-[#D4A373]/15 px-2 py-1 text-[10px] font-semibold text-[#9A6A3D] dark:text-[#D4A373]">{difficultyNames[exercise.difficulty]}</span>
                </div>
                <h4 className="mt-3 font-bold text-[#454638] group-hover:text-[#2E6F40] dark:text-[#E8E7DF] dark:group-hover:text-[#A8C69A]">{exercise.title}</h4>
                <p className={'mt-1 text-xs leading-relaxed ' + mutedClass}>{exercise.prompt}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#2E6F40] dark:text-[#A8C69A]">Iniciar atividade <span aria-hidden="true">→</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-[#E5E2D9] bg-[#FAF9F5] p-4 dark:border-[#343B30] dark:bg-[#20251E]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#5A5A40] dark:text-[#C8D1BD]">
          <BookOpen className="h-4 w-4" /> Referências técnicas consultadas
        </div>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#777468] dark:text-[#A6A395]">
          <li><a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1122295/1/BOLETIM-PD-24-ol.pdf" target="_blank" rel="noreferrer" className="font-semibold text-[#2E6F40] underline dark:text-[#A8C69A]">Embrapa — Desempenho de cultivares de soja em função da população de plantas</a>: componentes de produção incluem população final, legumes por planta, grãos por legume e massa de mil grãos.</li>
          <li><a href="https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1127264/1/LV-RecomendacaoSolo-2020-261-264.pdf" target="_blank" rel="noreferrer" className="font-semibold text-[#2E6F40] underline dark:text-[#A8C69A]">Embrapa — Recomendações de calagem e adubação para culturas anuais, capítulo da soja</a>: método de saturação por bases, V₂ de 60% no material consultado e critérios de gessagem para 20–40 cm.</li>
          <li><a href="https://www.iac.sp.gov.br/publicacoes/boletim100.php" target="_blank" rel="noreferrer" className="font-semibold text-[#2E6F40] underline dark:text-[#A8C69A]">IAC — Boletim 100, edição 2022</a>: referência estadual de recomendações de adubação e calagem para São Paulo.</li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[#8C897E] dark:text-[#A6A395]">As atividades são didáticas. A dose real de corretivos depende de amostragem representativa, camada avaliada, sistema de cultivo, cultura, PRNT e recomendação regional vigente. O gesso não substitui o calcário.</p>
      </div>
    </section>
  );
}
