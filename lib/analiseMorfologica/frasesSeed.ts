import type { Frase } from './types';

/**
 * Frases-semente extraídas de PROVAS REAIS de agronegócio.
 *
 * Tokenização (classe única e inequívoca no contexto):
 * - "Aqueles" → pronome (demonstrativo determinando o substantivo "cachorros");
 * - "muito" → advérbio (intensifica "rapidamente");
 * - "sim" → interjeição (afirmação no meio do período);
 * - "às" → contração: preposição "a" + artigo "as" (dois tokens no mesmo
 *   `grupo`, renderizados num único bloco clicável).
 *
 * `origem: 'prova'` → badge "Prova real" na UI.
 */
export const FRASES_SEED: Frase[] = [
  {
    id: 'seed_prova_1',
    origem: 'prova',
    tokens: [
      { palavra: 'Nossa', classe: 'interjeição' },
      { palavra: '!', pontuacao: true },
      { palavra: 'Aqueles', classe: 'pronome' },
      { palavra: 'dois', classe: 'numeral' },
      { palavra: 'cachorros', classe: 'substantivo' },
      { palavra: ',', pontuacao: true },
      { palavra: 'grandes', classe: 'adjetivo' },
      { palavra: ',', pontuacao: true },
      { palavra: 'mas', classe: 'conjunção' },
      { palavra: ',', pontuacao: true },
      { palavra: 'dóceis', classe: 'adjetivo' },
      { palavra: ',', pontuacao: true },
      { palavra: 'comiam', classe: 'verbo' },
      { palavra: ',', pontuacao: true },
      { palavra: 'a', classe: 'artigo' },
      { palavra: 'comida', classe: 'substantivo' },
      { palavra: ',', pontuacao: true },
      { palavra: 'muito', classe: 'advérbio' },
      { palavra: 'rapidamente', classe: 'advérbio' },
      { palavra: ',', pontuacao: true },
      { palavra: 'e', classe: 'conjunção' },
      { palavra: ',', pontuacao: true },
      { palavra: 'sim', classe: 'interjeição' },
      { palavra: ',', pontuacao: true },
      { palavra: 'obedeciam', classe: 'verbo' },
      { palavra: 'a', classe: 'preposição', grupo: 'g_as', grupoLabel: 'às' },
      { palavra: 'as', classe: 'artigo', grupo: 'g_as' },
      { palavra: 'suas', classe: 'pronome' },
      { palavra: 'donas', classe: 'substantivo' },
      { palavra: '.', pontuacao: true },
    ],
  },
];

/** Texto original do enunciado da prova (referência da seed acima). */
export const FRASES_SEED_TEXTO: Record<string, string> = {
  seed_prova_1:
    'Nossa! Aqueles dois cachorros grandes, mas dóceis, comiam a comida, muito rapidamente e, sim, obedeciam às suas donas.',
};
