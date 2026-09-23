'use client';

import React from 'react';
import { BookOpen, ExternalLink, Sparkles, Target } from 'lucide-react';
import type { TutorQuestion } from '@/lib/tutor/types';

interface QuestionCardProps {
  question: TutorQuestion;
  questionNumber: number;
  total: number;
}

const DIFICULDADE_LABEL: Record<string, string> = {
  basica: 'Básica',
  aplicacao: 'Aplicação',
  detalhamento: 'Detalhamento',
};

export default function QuestionCard({ question, questionNumber, total }: QuestionCardProps) {
  const alts = question.alternativas
    ? Object.entries(question.alternativas).filter(([, v]) => String(v || '').trim())
    : [];

  return (
    <div
      id="tutor_question"
      className="rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] bg-white dark:bg-[#1C201A] p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[#8C897E] dark:text-[#9EA399]">
          <Target className="size-3.5 text-[#2E6F40] dark:text-[#9CB386]" />
          <span className="font-semibold text-[#242A20] dark:text-[#F3F1EC]">
            Questão {questionNumber}
            <span className="font-normal"> / {total}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2E6F40]/10 text-[#2E6F40] dark:bg-[#9CB386]/15 dark:text-[#9CB386] font-medium">
            {DIFICULDADE_LABEL[question.dificuldade] || question.dificuldade}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              question.origem === 'pesquisada'
                ? 'bg-[#D4A373]/15 text-[#C19262]'
                : question.origem === 'artigo'
                  ? 'bg-[#2E6F40]/15 text-[#2E6F40] dark:bg-[#86efac]/15 dark:text-[#86efac]'
                  : 'bg-[#5A5A40]/10 text-[#5A5A40] dark:bg-[#9CB386]/10 dark:text-[#9CB386]'
            }`}
          >
            {question.origem === 'pesquisada'
              ? 'Questão pesquisada'
              : question.origem === 'artigo'
                ? 'De artigo'
                : 'Questão gerada'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C897E] dark:text-[#9EA399]">
        <BookOpen className="size-3.5 shrink-0" />
        <span>
          {question.assunto}
          {question.subassunto ? ` · ${question.subassunto}` : ''}
        </span>
        {question.tipo_prova && (
          <span className="px-1.5 py-0.5 rounded bg-[#F3F1EC] dark:bg-[#2C3328] text-[10px]">
            {question.tipo_prova}
          </span>
        )}
        {question.instituicao && (
          <span className="px-1.5 py-0.5 rounded bg-[#F3F1EC] dark:bg-[#2C3328] text-[10px]">
            {question.instituicao}
            {question.ano ? ` · ${question.ano}` : ''}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-[#242A20] dark:text-[#F3F1EC] whitespace-pre-wrap">
        {question.enunciado}
      </p>

      {alts.length > 0 && (
        <ul className="space-y-2">
          {alts.map(([key, value]) => (
            <li
              key={key}
              className="flex gap-2 text-sm rounded-xl px-3 py-2 bg-[#F3F1EC] dark:bg-[#2C3328] text-[#242A20] dark:text-[#F3F1EC]"
            >
              <span className="font-bold text-[#2E6F40] dark:text-[#9CB386] shrink-0">{key}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      )}

      {question.fonte_url && (
        <a
          href={question.fonte_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#2E6F40] dark:text-[#9CB386] hover:underline"
        >
          <ExternalLink className="size-3" />
          {question.fonte || 'Ver fonte'}
        </a>
      )}

      {!question.gabarito && question.origem === 'gerada' && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#8C897E] dark:text-[#9EA399]">
          <Sparkles className="size-3" />
          Questão discursiva — responda com suas palavras.
        </p>
      )}
    </div>
  );
}
