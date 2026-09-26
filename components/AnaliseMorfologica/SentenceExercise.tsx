'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  Hash,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  CLASSES,
  type ClasseGramatical,
  type Frase,
  type Token,
} from '@/lib/analiseMorfologica/types';
import { cn } from '@/lib/utils';

const ICONES: Record<ClasseGramatical, LucideIcon> = {
  substantivo: Tag,
  verbo: Zap,
  adjetivo: Palette,
  'advérbio': Timer,
  artigo: Pilcrow,
  numeral: Hash,
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

/**
 * Card com os chips das classes. É o MESMO card para todas as palavras:
 * memoizado e sem dependência da palavra ativa, para não re-renderizar
 * (nem reanimar) a cada troca de palavra — só o rótulo acima dele muda.
 */
const ClassChips = memo(function ClassChips({
  onPick,
}: {
  onPick: (classe: ClasseGramatical) => void;
}) {
  const { isDark } = useTheme();
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'text-[11px] font-bold uppercase tracking-wide',
          isDark ? 'text-[#9EA399]' : 'text-[#8C897E]'
        )}
      >
        Escolha a classe gramatical
      </div>
      <div className="flex flex-wrap gap-2">
        {CLASSES.map((c) => {
          const Icon = ICONES[c.id];
          const cor = isDark ? c.corDark : c.cor;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
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
    </div>
  );
});

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

  // Refs para o card de chips ser estável: sem re-render nem re-animação
  // quando só a palavra ativa muda (sincronizados fora do render).
  const estadoRef = useRef<{ idx: number | null; tok: Token | null }>({
    idx: null,
    tok: null,
  });
  const callbacksRef = useRef({ onResponder });

  useEffect(() => {
    estadoRef.current = { idx: ativa, tok: tokenAtivo };
    callbacksRef.current = { onResponder };
  }, [ativa, tokenAtivo, onResponder]);

  const handleResponder = useCallback((classe: ClasseGramatical) => {
    const { idx, tok } = estadoRef.current;
    if (idx == null || !tok?.classe) return;
    setFeedback({
      idx,
      palavra: tok.palavra,
      escolhida: classe,
      correta: tok.classe,
      correto: classe === tok.classe,
    });
    callbacksRef.current.onResponder(idx, classe);
  }, []);

  type Parte = { tok: Token; idx: number };
  type Item = { partes: Parte[]; grupo?: string; grupoLabel?: string };

  // Agrupa tokens consecutivos do mesmo `grupo` (contrações, ex.: "às").
  const itens: Item[] = [];
  for (let i = 0; i < frase.tokens.length; i++) {
    const tok = frase.tokens[i];
    const ultimo = itens[itens.length - 1];
    if (tok.grupo && ultimo?.grupo === tok.grupo) {
      ultimo.partes.push({ tok, idx: i });
      continue;
    }
    itens.push(
      tok.grupo
        ? { grupo: tok.grupo, grupoLabel: tok.grupoLabel, partes: [{ tok, idx: i }] }
        : { partes: [{ tok, idx: i }] }
    );
  }

  const renderParte = (parte: Parte, dentroGrupo: boolean, extraCls = '') => {
    const { tok, idx } = parte;

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

    const respondida = idx in respostas;
    const correta = respondida && respostas[idx] === tok.classe;
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
          dentroGrupo
            ? 'px-2.5 py-1.5 text-[15px] md:text-base font-medium transition-colors duration-150'
            : 'px-2.5 py-1.5 rounded-xl border text-[15px] md:text-base font-medium transition-all duration-150',
          extraCls,
          !respondida && 'cursor-pointer',
          !dentroGrupo &&
            !respondida &&
            'hover:-translate-y-0.5 active:translate-y-0',
          dentroGrupo && !respondida && 'hover:bg-black/[0.06] dark:hover:bg-white/[0.06]',
          !dentroGrupo &&
            !respondida &&
            !ativo &&
            (isDark
              ? 'bg-[#232821] border-[#3D3D3D] text-[#E8E6DF] hover:border-[#9CB386]'
              : 'bg-white border-[#D5D4D0] text-[#3D3D3D] hover:border-[#5A5A40]'),
          !dentroGrupo &&
            !respondida &&
            ativo &&
            'ring-2 ring-offset-2 ring-[#5A5A40] dark:ring-[#9CB386] ring-offset-[#F9F8F6] dark:ring-offset-[#161A14] border-[#5A5A40] dark:border-[#9CB386] shadow-sm',
          dentroGrupo &&
            !respondida &&
            !ativo &&
            (isDark ? 'text-[#E8E6DF]' : 'text-[#3D3D3D]'),
          dentroGrupo &&
            !respondida &&
            ativo &&
            (isDark ? 'text-[#9CB386] font-bold' : 'text-[#5A5A40] font-bold'),
          correta &&
            (dentroGrupo
              ? isDark
                ? 'text-green-300'
                : 'text-green-700'
              : isDark
                ? 'bg-green-900/30 border-green-500/60 text-green-300'
                : 'bg-green-50 border-green-400 text-green-700'),
          errada &&
            (dentroGrupo
              ? isDark
                ? 'text-red-300'
                : 'text-red-700'
              : isDark
                ? 'bg-red-900/30 border-red-500/60 text-red-300'
                : 'bg-red-50 border-red-400 text-red-700'),
          respondida && 'cursor-default'
        )}
        aria-pressed={respondida}
      >
        {tok.palavra}
      </button>
    );
  };

  const renderGrupo = (item: Item, key: string) => {
    const partes = item.partes;
    const respondidas = partes.filter((p) => p.idx in respostas);
    const todas = respondidas.length === partes.length;
    const todasCertas =
      todas && partes.every((p) => respostas[p.idx] === p.tok.classe);
    const algumaErrada = respondidas.some(
      (p) => respostas[p.idx] !== p.tok.classe
    );
    const temAtiva = partes.some((p) => p.idx === ativa);
    const label = item.grupoLabel ?? partes.map((p) => p.tok.palavra).join('');
    const decomposicao = partes.map((p) => p.tok.palavra).join(' + ');

    return (
      <span
        key={key}
        title={`“${label}” — decomposição: ${decomposicao}`}
        aria-label={`“${label}” — partes: ${partes.map((p) => p.tok.palavra).join(' e ')}`}
        className={cn(
          'inline-flex items-stretch rounded-xl border overflow-hidden',
          todasCertas &&
            (isDark
              ? 'border-green-500/60 bg-green-900/30'
              : 'border-green-400 bg-green-50'),
          !todasCertas &&
            algumaErrada &&
            (isDark
              ? 'border-red-500/60 bg-red-900/30'
              : 'border-red-400 bg-red-50'),
          !todasCertas &&
            !algumaErrada &&
            !temAtiva &&
            (isDark
              ? 'border-[#3D3D3D] bg-[#232821]'
              : 'border-[#D5D4D0] bg-white'),
          !todasCertas &&
            !algumaErrada &&
            temAtiva &&
            'ring-2 ring-offset-2 ring-[#5A5A40] dark:ring-[#9CB386] ring-offset-[#F9F8F6] dark:ring-offset-[#161A14] border-[#5A5A40] dark:border-[#9CB386] shadow-sm'
        )}
      >
        {partes.map((parte, i) =>
          renderParte(
            parte,
            true,
            i > 0
              ? cn(
                  'border-l border-dashed',
                  isDark ? 'border-[#5A5A40]/70' : 'border-[#D5D4D0]'
                )
              : ''
          )
        )}
      </span>
    );
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
        {itens.map((item, i) =>
          item.grupo
            ? renderGrupo(item, `grupo-${item.grupo}-${i}`)
            : renderParte(item.partes[0], false)
        )}
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

      {/* Chips das classes gramaticais — card único e estável (não reanima
          a cada troca de palavra) */}
      <AnimatePresence mode="wait">
        {ativaAberta && ativa != null && (
          <motion.div
            key="chips-classes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <ClassChips onPick={handleResponder} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
