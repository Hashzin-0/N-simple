import { CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS, MAX_CHUNKS_PER_SOURCE } from './config';

/**
 * Divide o texto completo de uma fonte em chunks para embedding.
 *
 * Estratégia: respeita fronteiras de parágrafo/frase sempre que possível
 * (em vez de cortar no meio de uma palavra), e mantém uma pequena
 * sobreposição entre chunks para não perder contexto que atravesse a
 * fronteira de corte — o mesmo princípio de "chunk-level context
 * aggregation" citado no LiteSemRAG para lidar com polissemia.
 */
export function chunkText(text: string): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  if (normalized.length <= CHUNK_TARGET_CHARS) {
    return [normalized];
  }

  // Primeiro tenta dividir por parágrafos/frases para preservar sentido.
  const sentences = normalized.match(/[^.!?]+[.!?]+(\s+|$)/g) || [normalized];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_TARGET_CHARS && current.length > 0) {
      chunks.push(current.trim());

      // Overlap: reaproveita o final do chunk anterior no início do próximo
      const overlapStart = Math.max(0, current.length - CHUNK_OVERLAP_CHARS);
      current = current.slice(overlapStart) + sentence;
    } else {
      current += sentence;
    }

    if (chunks.length >= MAX_CHUNKS_PER_SOURCE) break;
  }

  if (current.trim().length > 0 && chunks.length < MAX_CHUNKS_PER_SOURCE) {
    chunks.push(current.trim());
  }

  return chunks.slice(0, MAX_CHUNKS_PER_SOURCE);
}
