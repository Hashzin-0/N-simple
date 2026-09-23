/** Divide texto livre em termos de sinal (sem pontuação, máx. 8). */
export function extractSignsFromText(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 8);
}

/** Remove ponto/final de frase para não poluir a query do YouTube. */
export function stripSentenceEnding(text: string): string {
  return text.replace(/[.!?]+$/u, '').trim();
}
