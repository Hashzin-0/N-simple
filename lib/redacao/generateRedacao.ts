import { generateWithFallback } from '@/lib/llm-providers';
import { buildRedacaoPrompt } from '@/lib/prompts-redacao';
import type { RedacaoEstrutura, RepertorioItem, ExpressionGroup } from '@/components/PesquisadorRedacao/types';

interface GenerateRedacaoArgs {
  tema: string;
  estrutura: RedacaoEstrutura;
  repertorioSelecionado: RepertorioItem[];
  expressoesSelecionadas: ExpressionGroup[];
  modo: 'automatico' | 'construir';
}

/**
 * Gera o texto completo da redação com streaming.
 * Retorna um ReadableStream para streaming SSE na API route.
 */
export async function generateRedacao(args: GenerateRedacaoArgs): Promise<ReadableStream<Uint8Array>> {
  const { tema, estrutura, repertorioSelecionado, expressoesSelecionadas, modo } = args;

  const estruturaTexto = formatEstrutura(estrutura);
  const repertorioTexto = repertorioSelecionado
    .map(r => `- [${r.tipo}] ${r.conteudo} (Fonte: ${r.fonteTitulo || 'Conhecimento geral'})`)
    .join('\n');
  const expressoesTexto = expressoesSelecionadas
    .map(e => `[${e.categoria}] ${e.opcoes.join(' | ')}`)
    .join('\n');

  const prompt = buildRedacaoPrompt({
    tema,
    estrutura: estruturaTexto,
    repertorioSelecionado: repertorioTexto || 'Nenhum repertório selecionado.',
    expressoesSelecionadas: expressoesTexto || 'Nenhuma expressão selecionada.',
    modo,
  });

  const result = await generateWithFallback({ prompt });

  // Retorna o stream raw do LLM para streaming na API
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(value.text));
        }
      } finally {
        controller.close();
      }
    },
  });
}

function formatEstrutura(estrutura: RedacaoEstrutura): string {
  const lines: string[] = [];

  lines.push('INTRODUÇÃO:');
  lines.push(`  Tese: ${estrutura.introducao.tese}`);
  lines.push(`  Argumentos: ${estrutura.introducao.argumentos.join(' e ')}`);
  lines.push('');

  for (const dev of estrutura.desenvolvimentos) {
    lines.push(`DESENVOLVIMENTO ${dev.numero}:`);
    lines.push(`  Argumento: ${dev.argumento}`);
    lines.push(`  Tópico frasal: ${dev.topicoFrasal}`);
    lines.push(`  Explicação: ${dev.explicacao}`);
    if (dev.repertorio.length > 0) {
      lines.push(`  Repertório: ${dev.repertorio.join('; ')}`);
    }
    lines.push(`  Relação com tema: ${dev.relacaoComTema}`);
    lines.push(`  Conclusão parcial: ${dev.conclusaoParcial}`);
    lines.push('');
  }

  lines.push('CONCLUSÃO:');
  lines.push(`  ${estrutura.conclusao.conteudo}`);

  return lines.join('\n');
}
