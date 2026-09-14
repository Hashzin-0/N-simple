import { embedTexts, cosineSimilarity } from './embeddings';
import { MAX_CATEGORIES_PER_SOURCE } from './config';

/**
 * Categorização semântica de uma fonte, sem LLM (estilo KeyBERT):
 * 1. Gera frases candidatas (1 a 3 palavras) do texto completo.
 * 2. Embeda cada candidata e compara por cosseno com o embedding do
 *    documento inteiro (centróide dos chunks).
 * 3. As candidatas mais próximas semanticamente do documento são o
 *    "índice de assunto" — o que a fonte realmente aborda — e não uma
 *    lista de palavras mais frequentes (frequência ≠ relevância temática).
 *
 * Isso substitui o `SYNONYM_MAP` hardcoded de `topicExtractor.ts`, que
 * só reconhecia um punhado de termos agronômicos pré-cadastrados.
 */

export interface SemanticCategory {
  label: string;
  score: number; // 0-100
}

const STOP_WORDS = new Set([
  'que', 'com', 'para', 'por', 'uma', 'um', 'dos', 'das', 'nas', 'nos', 'sobre',
  'como', 'pelo', 'pela', 'entre', 'mais', 'este', 'esta', 'esse', 'essa', 'seu',
  'qual', 'quais', 'onde', 'quando', 'muito', 'cada', 'seus', 'suas', 'isso',
  'usando', 'utilizando', 'fazendo', 'tendo', 'sendo', 'podendo', 'sao', 'foi',
  'pode', 'devem', 'deve', 'ser', 'ter', 'esta', 'estao', 'era', 'the', 'and',
  'for', 'from', 'that', 'this', 'are', 'was', 'were', 'with', 'have', 'has',
  'não', 'nao', 'também', 'tambem', 'ainda', 'apenas', 'entre', 'após', 'apos',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();
}

function extractCandidatePhrases(text: string): string[] {
  const normalized = normalize(text);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  const candidates = new Map<string, number>();

  const addCandidate = (phrase: string) => {
    candidates.set(phrase, (candidates.get(phrase) || 0) + 1);
  };

  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    if (w1.length < 4 || STOP_WORDS.has(w1)) continue;

    addCandidate(w1);

    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      if (w2.length >= 3 && !STOP_WORDS.has(w2)) {
        addCandidate(`${w1} ${w2}`);
      }
    }

    if (i + 2 < words.length) {
      const w2 = words[i + 1];
      const w3 = words[i + 2];
      if (!STOP_WORDS.has(w3) && w3.length >= 3) {
        addCandidate(`${w1} ${w2} ${w3}`);
      }
    }
  }

  // Mantém só candidatas com repetição mínima (evita ruído de termos únicos)
  // ou bigramas/trigramas plausíveis (frases compostas costumam aparecer só 1x
  // mesmo sendo o assunto central, então damos uma chance a elas também).
  return [...candidates.entries()]
    .filter(([phrase, count]) => count >= 2 || phrase.includes(' '))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([phrase]) => phrase);
}

function dedupeOverlapping(ranked: SemanticCategory[]): SemanticCategory[] {
  const kept: SemanticCategory[] = [];
  for (const candidate of ranked) {
    const isSubsumed = kept.some(
      (k) => k.label.includes(candidate.label) || candidate.label.includes(k.label)
    );
    if (!isSubsumed) kept.push(candidate);
  }
  return kept;
}

/**
 * Extrai as categorias semânticas de uma fonte a partir do texto completo
 * (ou abstract, se o texto completo não estiver disponível) e do embedding
 * já calculado do documento (centróide dos chunks).
 */
export async function extractSemanticCategories(
  fullText: string,
  docEmbedding: number[]
): Promise<SemanticCategory[]> {
  const candidates = extractCandidatePhrases(fullText);
  if (candidates.length === 0) return [];

  const candidateEmbeddings = await embedTexts(candidates);

  const ranked = candidates
    .map((label, idx) => ({
      label,
      score: Math.round(Math.max(0, cosineSimilarity(candidateEmbeddings[idx], docEmbedding)) * 1000) / 10,
    }))
    .sort((a, b) => b.score - a.score);

  return dedupeOverlapping(ranked).slice(0, MAX_CATEGORIES_PER_SOURCE);
}
