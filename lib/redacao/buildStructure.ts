import { generateWithFallback } from '@/lib/llm-providers';
import { buildStructurePrompt } from '@/lib/prompts-redacao';
import type { RepertorioItem, RedacaoEstrutura } from '@/components/PesquisadorRedacao/types';

interface BuildStructureResult {
  estrutura: RedacaoEstrutura;
}

/**
 * Gera a estrutura da redação (tese, argumentos, plano de cada parágrafo).
 * Separado da geração de texto para permitir validação antes de redigir.
 */
export async function buildStructure(
  tema: string,
  repertorio: RepertorioItem[],
): Promise<BuildStructureResult> {
  const repertorioResumo = repertorio
    .slice(0, 15)
    .map(r => `- [${r.tipo}] ${r.titulo}: ${r.conteudo}`)
    .join('\n');

  const prompt = buildStructurePrompt({ tema, repertorioResumo });

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
    throw new Error('LLM não retornou JSON válido na geração de estrutura');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validação da estrutura
  if (!parsed.introducao || !parsed.desenvolvimentos || !parsed.conclusao) {
    throw new Error('Estrutura incompleta: falta introdução, desenvolvimentos ou conclusão');
  }

  const numDesenvolvimentos = parsed.desenvolvimentos.length;
  if (numDesenvolvimentos < 2 || numDesenvolvimentos > 3) {
    throw new Error(`Estrutura inválida: ${numDesenvolvimentos} desenvolvimentos (mínimo 2, máximo 3)`);
  }

  const estrutura: RedacaoEstrutura = {
    introducao: {
      conteudo: parsed.introducao.contextualizacao + ' ' + parsed.introducao.problema + ' ' + parsed.introducao.tese,
      tese: parsed.introducao.tese,
      argumentos: parsed.introducao.argumentos || [],
    },
    desenvolvimentos: parsed.desenvolvimentos.map((d: Record<string, unknown>) => ({
      tipo: 'desenvolvimento' as const,
      numero: d.numero as 1 | 2 | 3,
      argumento: d.argumento as string,
      topicoFrasal: d.topicoFrasal as string,
      explicacao: d.explicacao as string,
      repertorio: Array.isArray(d.repertorio) ? d.repertorio as string[] : [],
      relacaoComTema: d.relacaoComTema as string,
      conclusaoParcial: d.conclusaoParcial as string,
    })),
    conclusao: {
      conteudo: [parsed.conclusao.retomadaTese, parsed.conclusao.sintese, parsed.conclusao.fechamento].join(' '),
    },
    temTerceiroDesenvolvimento: numDesenvolvimentos === 3,
  };

  return { estrutura };
}
