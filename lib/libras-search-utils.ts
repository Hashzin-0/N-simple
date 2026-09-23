/** Normaliza texto para comparação: minúsculas + sem acentos. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'do', 'da', 'das', 'dos', 'em', 'um', 'uma', 'uns', 'umas',
  'no', 'na', 'nos', 'nas', 'com', 'por', 'para', 'sem', 'sob', 'sobre', 'entre',
  'eu', 'tu', 'ele', 'ela', 'is', 'isto', 'isso', 'aquilo', 'vos',
  'eles', 'elas', 'me', 'te', 'se', 'lhe', 'lhes', 'meu', 'minha', 'meus', 'minhas',
  'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'esse', 'essa', 'este', 'esta',
  'aquele', 'aquela', 'mas', 'ou', 'que', 'ja', 'mais', 'menos', 'muito', 'pouco',
  'todo', 'toda', 'todos', 'todas', 'num', 'numa', 'pelo', 'pela', 'pelos', 'pelas',
  'como', 'quando', 'onde', 'qual', 'quais', 'quem', 'porque', 'pois', 'the', 'and',
  'era', 'ser', 'estar', 'tem', 'ter', 'foi', 'sao',
]);

/** Divide texto livre em termos de sinal (sem pontuação, sem stopwords, máx. 8). */
export function extractSignsFromText(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(normalizeText(w)))
    .slice(0, 8);
}

/** Remove ponto/final de frase para não poluir a query do YouTube. */
export function stripSentenceEnding(text: string): string {
  return text.replace(/[.!?…]+$/u, '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifica se `needle` aparece em `haystack` como palavra inteira
 * (não como substring de outra palavra: "planta" não casa em "plantadeira").
 * Ambos devem ser preferencialmente já normalizados.
 */
export function includesWholeWord(haystack: string, needle: string): boolean {
  const n = normalizeText(needle);
  if (!n) return false;
  const h = normalizeText(haystack);
  const pattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(n)}(?:[^a-z0-9]|$)`,
    'i'
  );
  return pattern.test(h);
}
