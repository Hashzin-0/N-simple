import { generateWithFallback } from '@/lib/llm-providers';
import { buildRepertorioExtractionPrompt } from '@/lib/prompts-redacao';
import { formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import type { UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import type { RepertorioItem } from '@/components/PesquisadorRedacao/types';

interface ExtractRepertorioResult {
  repertorio: RepertorioItem[];
}

/**
 * Extrai repertório utilizável em redações a partir de fontes pesquisadas.
 * Chama o LLM com um prompt estruturado para analisar fontes e retornar
 * itens de repertório categorizados.
 */
export async function extractRepertorio(
  tema: string,
  fontes: UnderstoodSource[],
  topics: string[],
): Promise<ExtractRepertorioResult> {
  const fontesContext = formatSourcesByTopic(fontes, topics);

  const prompt = buildRepertorioExtractionPrompt({ tema, fontesContext });

  const result = await generateWithFallback({ prompt });

  let fullText = '';
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += value.text;
  }

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('LLM não retornou JSON válido na extração de repertório');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ExtractRepertorioResult;

  // Validação básica
  if (!Array.isArray(parsed.repertorio) || parsed.repertorio.length === 0) {
    throw new Error('Repertório extraído está vazio ou em formato inválido');
  }

  return parsed;
}
