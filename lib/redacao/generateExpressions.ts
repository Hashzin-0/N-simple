import { generateWithFallback } from '@/lib/llm-providers';
import { buildExpressionGenerationPrompt } from '@/lib/prompts-redacao';
import type { ExpressionGroup } from '@/components/PesquisadorRedacao/types';
import type { RepertorioItem } from '@/components/PesquisadorRedacao/types';

interface GenerateExpressionsResult {
  expressoes: ExpressionGroup[];
}

/**
 * Gera expressões e conectivos organizados por finalidade,
 * específicos para o tema e repertório disponíveis.
 */
export async function generateExpressions(
  tema: string,
  repertorio: RepertorioItem[],
): Promise<GenerateExpressionsResult> {
  const repertorioResumo = repertorio
    .slice(0, 15)
    .map(r => `- [${r.tipo}] ${r.titulo}: ${r.conteudo}`)
    .join('\n');

  const prompt = buildExpressionGenerationPrompt({ tema, repertorioResumo });

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
    throw new Error('LLM não retornou JSON válido na geração de expressões');
  }

  const parsed = JSON.parse(jsonMatch[0]) as GenerateExpressionsResult;

  if (!Array.isArray(parsed.expressoes) || parsed.expressoes.length === 0) {
    throw new Error('Expressões geradas estão vazias ou em formato inválido');
  }

  return parsed;
}
