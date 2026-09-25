'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle,
  XCircle,
  Tag,
  Zap,
  Palette,
  Timer,
  Pilcrow,
  CornerDownRight,
  GitBranch,
  User,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  CLASSES,
  type ClasseGramatical,
  type Frase,
} from '@/lib/analiseMorfologica/types';
import { cn } from '@/lib/utils';

const ICONES: Record<ClasseGramatical, LucideIcon> = {
  substantivo: Tag,
  verbo: Zap,
  adjetivo: Palette,
  'advérbio': Timer,
  artigo: Pilcrow,
  preposição: CornerDownRight,
  conjunção: GitBranch,
  pronome: User,
  'interjeição': Megaphone,
};

interface SentenceExerciseProps {
  frase: Frase;
  respostas: Record<number, ClasseGramatical>;
  ativa: number | null;
  onSelecionar: (idx: number) => void;
  onResponder: (idx: number, classe: ClasseGramatical) => void;
}

interface Feedback {
  idx: number;
  palavra: string;
  escolhida: ClasseGramatical;
  correta: ClasseGramatical;
  correto: boolean;
}

export default function SentenceExercise({
  frase,
  respostas,
  ativa,
  onSelecionar,
  onResponder,
}: SentenceExerciseProps) {
  const { isDark } = useTheme();
  // O pai remonta o componente (key) a cada frase nova, então o feedback
  // começa em null automaticamente.
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clicaveis = frase.tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !t.pontuacao && t.classe);

  const respondidas = clicaveis.filter(({ i }) => i in respostas).length;

  const tokenAtivo = ativa != null ? frase.tokens[ativa] : null;
  const ativaAberta =
    ativa != null && !tokenAtivo?.pontuacao && !(ativa in respostas);

  const handleResponder = (classe: ClasseGramatical) => {
    if (ativa == null || !tokenAtivo?.classe) return;
    setFeedback({
      idx: ativa,
      palavra: tokenAtivo.palavra,
      escolhida: classe,
      correta: tokenAtivo.classe,
      correto: classe === tokenAtivo.classe,
    });
    onResponder(ativa, classe);
  };

  return (
    <div className="space-y-3">
      {/* Frase com palavras clicáveis */}
      <div
        className={cn(
          'flex flex-wrap items-baseline gap-x-1.5 gap-y-2 p-4 rounded-2xl border',
          isDark
            ? 'bg-[#161A14] border-[#2C3328]'
            : 'bg-[#F9F8F6] border-[#E5E2D9]'
        )}
        role="group"
        aria-label="Frase para análise morfológica"
      >
        {frase.tokens.map((tok, idx) => {
          if (tok.pontuacao || !tok.classe) {
            return (
              <span
                key={idx}
                className={cn(
                  'px-0.5 text-[15px] md:text-base',
                  isDark ? 'text-[#5A5A40]' : 'text-[#8C897E]'
                )}
              >
                {tok.palavra}
              </span>
            );
          }

          const resposta = respostas[idx];
          const respondida = resposta != null;
          const correta = respondida && resposta === tok.classe;
          const errada = respondida && !correta;
          const ativo = ativa === idx;

          return (
            <button
              key={idx}
              type="button"
              disabled={respondida}
              onClick={() => onSelecionar(idx)}
              title={
                respondida
                  ? `${tok.palavra}: ${tok.classe}`
                  : `Clique em "${tok.palavra}" para classificar`
              }
              className={cn(
                'px-2.5 py-1.5 rounded-xl border text-[15px] md:text-base font-medium transition-all duration-150',
                !respondida &&
                  'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
                !respondida &&
                  !ativo &&
                  (isDark
                    ? 'bg-[#232821] border-[#3D3D3D] text-[#E8E6DF] hover:border-[#9CB386]'
                    : 'bg-white border-[#D5D4D0] text-[#3D3D3D] hover:border-[#5A5A40]'),
                !respondida &&
                  ativo &&
                  'ring-2 ring-offset-2 ring-[#5A5A40] dark:ring-[#9CB386] ring-offset-[#F9F8F6] dark:ring-offset-[#161A14] border-[#5A5A40] dark:border-[#9CB386] shadow-sm',
                correta &&
                  (isDark
                    ? 'bg-green-900/30 border-green-500/60 text-green-300'
                    : 'bg-green-50 border-green-400 text-green-700'),
                errada &&
                  (isDark
                    ? 'bg-red-900/30 border-red-500/60 text-red-300'
                    : 'bg-red-50 border-red-400 text-red-700'),
                respondida && 'cursor-default'
              )}
              aria-pressed={respondida}
            >
              {tok.palavra}
            </button>
          );
        })}
      </div>

      {/* Progresso da frase */}
      <div
        className={cn(
          'flex items-center justify-between text-[11px] font-semibold',
          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
        )}
      >
        <span>
          {respondidas} de {clicaveis.length} palavras classificadas
        </span>
        <span className="flex items-center gap-1">
          {ativaAberta ? (
            <>Classifique: <b className="text-[#5A5A40] dark:text-[#9CB386]">“{tokenAtivo?.palavra}”</b></>
          ) : respondidas === clicaveis.length ? (
            'Frase concluída'
          ) : (
            'Clique em uma palavra'
          )}
        </span>
      </div>

      {/* Feedback da última resposta */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={`fb-${feedback.idx}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'flex items-start gap-2 px-3.5 py-3 rounded-xl text-xs',
              feedback.correto
                ? isDark
                  ? 'bg-green-900/25 text-green-300'
                  : 'bg-green-50 text-green-700'
                : isDark
                  ? 'bg-red-900/25 text-red-300'
                  : 'bg-red-50 text-red-700'
            )}
          >
            {feedback.correto ? (
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-bold">
                {feedback.correto
                  ? 'Correto!'
                  : 'Quase — a classe é outra.'}
              </p>
              <p className="opacity-90">
                “{feedback.palavra}” é{' '}
                <b>{feedback.correta}</b>
                {!feedback.correto && (
                  <> (você marcou {feedback.escolhida})</>
                )}
                .
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chips das 9 classes gramaticais */}
      <AnimatePresence mode="wait">
        {ativaAberta && ativa != null && (
          <motion.div
            key={`chips-${ativa}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            <div
              className={cn(
                'text-[11px] font-bold uppercase tracking-wide',
                isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
              )}
            >
              Qual é a classe de “{tokenAtivo?.palavra}”?
            </div>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => {
                const Icon = ICONES[c.id];
                const cor = isDark ? c.corDark : c.cor;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleResponder(c.id)}
                    title={c.dica}
                    style={{
                      borderColor: cor,
                      backgroundColor: `${cor}14`,
                      color: cor,
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
