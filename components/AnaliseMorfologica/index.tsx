'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Languages,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  RotateCcw,
  Flame,
  Trophy,
  CheckCircle,
  XCircle,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import CalculationIsland from '@/components/CalculationIsland';
import CalculationMemoryPanel from '@/components/CalculationMemoryPanel';
import { ElasticText } from '@/components/godui/elastic-text';
import { cn } from '@/lib/utils';
import { usePersistedState } from '@/hooks/usePersistedState';
import { gerarFraseLocal, fingerprintFrase } from '@/lib/analiseMorfologica/gerarLocal';
import {
  PROGRESSO_INICIAL,
  type ClasseGramatical,
  type Frase,
  type ProgressoAnalise,
} from '@/lib/analiseMorfologica/types';
import SentenceExercise from './SentenceExercise';

const STORAGE_KEY = 'n_calc_analise_morfologica_v1';

interface HudItemProps {
  icon: LucideIcon;
  valor: number | string;
  label: string;
  cor: string;
}

function HudItem({ icon: Icon, valor, label, cor }: HudItemProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold"
      style={{ borderColor: `${cor}55`, backgroundColor: `${cor}14`, color: cor }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {valor}
      <span className="font-semibold opacity-70">{label}</span>
    </span>
  );
}

export default function AnaliseMorfologica() {
  const { isDark } = useTheme();
  const [showCalc, setShowCalc] = useState(false);
  const [frase, setFrase] = useState<Frase | null>(null);
  const [fraseKey, setFraseKey] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, ClasseGramatical>>({});
  const [ativa, setAtiva] = useState<number | null>(null);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [progresso, setProgresso] = usePersistedState<ProgressoAnalise>(
    STORAGE_KEY,
    PROGRESSO_INICIAL
  );
  const recentesRef = useRef<string[]>([]);

  const clicaveis = useMemo(() => {
    if (!frase) return [];
    return frase.tokens
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !t.pontuacao && t.classe)
      .map(({ i }) => i);
  }, [frase]);

  const concluida = clicaveis.length > 0 && clicaveis.every((i) => i in respostas);

  const acertosFrase = useMemo(() => {
    if (!frase) return 0;
    return clicaveis.filter((i) => frase.tokens[i].classe === respostas[i]).length;
  }, [frase, clicaveis, respostas]);

  const aplicarFrase = useCallback((f: Frase, avisoTexto: string | null = null) => {
    setFrase(f);
    setFraseKey((k) => k + 1);
    setRespostas({});
    setAviso(avisoTexto);
    const primeiro = f.tokens.findIndex((t) => !t.pontuacao);
    setAtiva(primeiro >= 0 ? primeiro : null);
  }, []);

  const novaLocal = useCallback(
    (avisoTexto: string | null = null) => {
      const nova = gerarFraseLocal(recentesRef.current);
      recentesRef.current = [...recentesRef.current, fingerprintFrase(nova)].slice(-11);
      aplicarFrase(nova, avisoTexto);
    },
    [aplicarFrase]
  );

  useEffect(() => {
    novaLocal();
  }, [novaLocal]);

  const gerarComIA = useCallback(async () => {
    if (gerandoIA) return;
    setGerandoIA(true);
    setAviso(null);
    try {
      const res = await fetch('/api/analise-morfologica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data: unknown = await res.json().catch(() => ({}));
      const tokens =
        res.ok &&
        typeof data === 'object' &&
        data !== null &&
        Array.isArray((data as { frase?: { tokens?: unknown } }).frase?.tokens)
          ? ((data as { frase: { tokens: Frase['tokens'] } }).frase.tokens)
          : null;

      if (!tokens || tokens.length === 0) {
        throw new Error('Resposta inválida da IA');
      }

      aplicarFrase({ id: `ia_${Date.now()}`, tokens, origem: 'ia' });
    } catch {
      novaLocal('Não consegui gerar uma frase com IA agora — segue uma frase local.');
    } finally {
      setGerandoIA(false);
    }
  }, [gerandoIA, aplicarFrase, novaLocal]);

  const handleSelecionar = useCallback((idx: number) => {
    setAtiva(idx);
  }, []);

  const handleResponder = useCallback(
    (idx: number, classe: ClasseGramatical) => {
      if (!frase) return;

      const novas = { ...respostas, [idx]: classe };
      setRespostas(novas);

      const correto = frase.tokens[idx].classe === classe;
      const todos = clicaveis.every((i) => i in novas);
      const perfeita =
        todos && clicaveis.every((i) => frase.tokens[i].classe === novas[i]);

      setProgresso((p) => {
        const acertos = p.acertos + (correto ? 1 : 0);
        const erros = p.erros + (correto ? 0 : 1);
        if (!todos) return { ...p, acertos, erros };

        const sequencia = perfeita ? p.sequenciaAtual + 1 : 0;
        return {
          acertos,
          erros,
          frasesResolvidas: p.frasesResolvidas + 1,
          sequenciaAtual: sequencia,
          melhorSequencia: Math.max(p.melhorSequencia, sequencia),
        };
      });

      // Auto-avanço: foco já cai na próxima palavra não classificada.
      const posterior = clicaveis.find((i) => i > idx && !(i in novas));
      const proximo =
        posterior ?? clicaveis.find((i) => !(i in novas)) ?? null;
      setAtiva(proximo);
    },
    [frase, respostas, clicaveis, setProgresso]
  );

  const zerarPontuacao = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm('Zerar a pontuação da análise morfológica?')) {
      setProgresso(PROGRESSO_INICIAL);
    }
  }, [setProgresso]);

  const errosDaFrase = frase
    ? clicaveis
        .filter((i) => respostas[i] !== frase.tokens[i].classe)
        .map((i) => ({
          idx: i,
          palavra: frase.tokens[i].palavra,
          correta: frase.tokens[i].classe,
          escolhida: respostas[i],
        }))
    : [];

  return (
    <div
      id="analise_morfologica"
      className="relative bg-white dark:bg-[#1C201A] rounded-3xl border border-[#E5E2D9] dark:border-[#2C3328] p-5 shadow-sm transition-colors scroll-mt-24"
    >
      <CalculationIsland
        isVisible={showCalc}
        onToggle={() => setShowCalc(!showCalc)}
        accentColor="#5A5A40"
        darkAccentColor="#9CB386"
        isDark={isDark}
      />
      <div className="space-y-4">
        {/* Cabeçalho */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Languages className="h-5 w-5 text-[#5A5A40] dark:text-[#9CB386]" />
            <ElasticText
              className="text-[10px] font-bold text-[#8C897E] dark:text-[#9EA399] uppercase block"
              mode="auto"
            >
              Análise Morfológica
            </ElasticText>
          </div>
          <p className="text-xs text-[#8C897E] dark:text-[#9EA399]">
            A frase é montada na hora. Clique em cada palavra e informe a classe:
            substantivo, verbo, adjetivo, advérbio, artigo, preposição, conjunção, pronome ou interjeição.
          </p>
        </div>

        {/* Placar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <HudItem
            icon={CheckCircle}
            valor={progresso.acertos}
            label="acertos"
            cor={isDark ? '#86efac' : '#2E6F40'}
          />
          <HudItem
            icon={XCircle}
            valor={progresso.erros}
            label="erros"
            cor={isDark ? '#F0929A' : '#B5484D'}
          />
          <HudItem
            icon={Flame}
            valor={progresso.sequenciaAtual}
            label="sequência"
            cor={isDark ? '#E0A96D' : '#D4A373'}
          />
          <HudItem
            icon={Trophy}
            valor={progresso.melhorSequencia}
            label="melhor"
            cor={isDark ? '#CBB5A1' : '#8D6E63'}
          />
          <HudItem
            icon={Languages}
            valor={progresso.frasesResolvidas}
            label="frases"
            cor={isDark ? '#9CB386' : '#5A5A40'}
          />
          <button
            type="button"
            onClick={zerarPontuacao}
            title="Zerar pontuação"
            className={cn(
              'p-1.5 rounded-full border transition-all hover:rotate-[-180deg]',
              isDark
                ? 'border-[#3D3D3D] text-[#9EA399] hover:border-[#9CB386]'
                : 'border-[#D5D4D0] text-[#8C897E] hover:border-[#5A5A40]'
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => novaLocal()}
            disabled={gerandoIA}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]',
              'bg-[#5A5A40] text-white hover:bg-[#7A763A]',
              gerandoIA && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Nova frase
          </button>
          <button
            type="button"
            onClick={gerarComIA}
            disabled={gerandoIA}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border active:scale-[0.98]',
              isDark
                ? 'bg-[#161A14] border-[#3D3D3D] text-[#9CB386] hover:bg-[#232821]'
                : 'bg-[#F9F8F6] border-[#D5D4D0] text-[#5A5A40] hover:bg-[#F0EDE5]',
              gerandoIA && 'opacity-50 cursor-not-allowed'
            )}
          >
            {gerandoIA ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Gerar com IA
          </button>
        </div>

        {gerandoIA && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium',
              isDark ? 'bg-[#232821] text-[#9CB386]' : 'bg-[#F0EDE5] text-[#5A5A40]'
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando frase com IA...
          </div>
        )}

        {aviso && !gerandoIA && (
          <div
            className={cn(
              'flex items-start gap-2 px-4 py-3 rounded-xl text-xs',
              isDark
                ? 'bg-amber-900/20 text-amber-400'
                : 'bg-amber-50 text-amber-700'
            )}
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{aviso}</span>
          </div>
        )}

        {/* Exercício */}
        {frase ? (
          <div className="space-y-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                frase.origem === 'ia'
                  ? isDark
                    ? 'bg-[#232821] border-[#9CB386]/40 text-[#9CB386]'
                    : 'bg-[#F0EDE5] border-[#5A5A40]/40 text-[#5A5A40]'
                  : isDark
                    ? 'bg-[#161A14] border-[#3D3D3D] text-[#9EA399]'
                    : 'bg-white border-[#D5D4D0] text-[#8C897E]'
              )}
            >
              <Sparkles className="h-3 w-3" />
              {frase.origem === 'ia' ? 'Gerada com IA' : 'Frase local'}
            </span>

            <SentenceExercise
              key={fraseKey}
              frase={frase}
              respostas={respostas}
              ativa={ativa}
              onSelecionar={handleSelecionar}
              onResponder={handleResponder}
            />

            {/* Conclusão da frase */}
            {concluida && (
              <div
                className={cn(
                  'p-4 rounded-2xl border space-y-3',
                  isDark
                    ? 'bg-[#232821] border-[#2C3328]'
                    : 'bg-[#F9F8F6] border-[#E5E2D9]'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className={cn(
                      'flex items-center gap-2 text-xs font-bold',
                      isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]'
                    )}
                  >
                    <Trophy className="h-4 w-4" />
                    Frase concluída: {acertosFrase} de {clicaveis.length} acertos
                  </div>
                  {acertosFrase === clicaveis.length && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{
                        backgroundColor: `${isDark ? '#E0A96D' : '#D4A373'}14`,
                        color: isDark ? '#E0A96D' : '#D4A373',
                      }}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      Sequência {progresso.sequenciaAtual}
                    </span>
                  )}
                </div>

                {errosDaFrase.length > 0 && (
                  <ul className="space-y-1 text-[11px]">
                    {errosDaFrase.map((e) => (
                      <li
                        key={e.idx}
                        className={cn(
                          'flex items-center gap-1.5',
                          isDark ? 'text-[#F0929A]' : 'text-[#B5484D]'
                        )}
                      >
                        <XCircle className="h-3 w-3 shrink-0" />
                        <span>
                          “{e.palavra}” é <b>{e.correta}</b>
                          {e.escolhida ? ` (você marcou ${e.escolhida})` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => novaLocal()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all bg-[#5A5A40] text-white hover:bg-[#7A763A] active:scale-[0.98] shadow-sm"
                >
                  Próxima frase
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <p
            className={cn(
              'text-xs px-4 py-6 text-center rounded-xl',
              isDark ? 'bg-[#161A14] text-[#9EA399]' : 'bg-[#F9F8F6] text-[#8C897E]'
            )}
          >
            Preparando a primeira frase...
          </p>
        )}

        {/* Memória de cálculo / Como funciona */}
        <CalculationMemoryPanel isVisible={showCalc} isDark={isDark}>
          <div
            className={cn(
              'p-2.5 rounded-lg border font-mono text-[11px] leading-relaxed',
              isDark
                ? 'bg-[#232821] border-[#2C3328] text-[#E8E6DF]'
                : 'bg-white border-[#E5E2D9] text-[#3D3D3D]'
            )}
          >
            <div className={cn('font-semibold mb-1', isDark ? 'text-[#9EA399]' : 'text-[#8C897E]')}>
              COMO FUNCIONA:
            </div>
            <div className={cn('font-bold', isDark ? 'text-[#9CB386]' : 'text-[#5A5A40]')}>
              <ElasticText className="font-bold" mode="auto">
                Análise Morfológica
              </ElasticText>
            </div>
            <p className={cn('mt-1', isDark ? 'text-[#9EA399]' : 'text-[#8C897E]')}>
              A frase é montada na hora a partir de templates e bancos de palavras locais
              (rápido, offline e com correção garantida), ou gerada por IA pelo botão
              “Gerar com IA”. Cada palavra é um token clicável: ao escolher a classe, o
              sistema valida na hora e mostra a resposta correta. As 9 classes cobrem as
              variáveis (substantivo, verbo, adjetivo, advérbio) e as invariáveis
              (artigo, preposição, conjunção, pronome, interjeição). A pontuação e a
              sequência de frases perfeitas ficam salvas neste dispositivo.
            </p>
          </div>
        </CalculationMemoryPanel>
      </div>
    </div>
  );
}
