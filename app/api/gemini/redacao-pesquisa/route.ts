import { NextRequest } from 'next/server';
import { searchSources } from '@/lib/research';
import { extractRepertorio } from '@/lib/redacao/extractRepertorio';
import { generateExpressions } from '@/lib/redacao/generateExpressions';
import type { RedacaoResearchContext } from '@/components/PesquisadorRedacao/types';
import { PROMPT_VERSION } from '@/lib/prompts-redacao';
import { closeBrowser } from '@/lib/stealthBrowser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { tema } = await req.json();
    const cleanTema = (tema || '').trim();

    if (!cleanTema) {
      return Response.json(
        { error: 'O parâmetro tema é obrigatório.' },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
        };

        try {
          // ── Etapa 1: Pesquisa de fontes ──
          sendEvent('progress', { etapa: 'pesquisa', mensagem: 'Pesquisando fontes científicas...' });

          const searchResult = await searchSources({
            query: cleanTema,
            domain: 'redacao',
          });

          sendEvent('progress', {
            etapa: 'pesquisa_completa',
            mensagem: `${searchResult.sources.length} fontes encontradas`,
            fontes: searchResult.sources.length,
            reutilizadas: searchResult.reusedSources.length,
            novas: searchResult.newSources.length,
          });

          // ── Etapa 2: Extração de repertório ──
          sendEvent('progress', { etapa: 'repertorio', mensagem: 'Extraindo repertório das fontes...' });

          const repertorioResult = await extractRepertorio(
            cleanTema,
            searchResult.sources,
            searchResult.topics,
          );

          sendEvent('progress', {
            etapa: 'repertorio_completo',
            mensagem: `${repertorioResult.repertorio.length} itens de repertório extraídos`,
            repertorioCount: repertorioResult.repertorio.length,
          });

          // ── Etapa 3: Geração de expressões ──
          sendEvent('progress', { etapa: 'expressoes', mensagem: 'Gerando expressões e conectivos...' });

          const expressoesResult = await generateExpressions(
            cleanTema,
            repertorioResult.repertorio,
          );

          sendEvent('progress', {
            etapa: 'expressoes_completas',
            mensagem: `${expressoesResult.expressoes.length} categorias de expressões geradas`,
            expressoesCount: expressoesResult.expressoes.length,
          });

          // ── Resultado final ──
          const context: RedacaoResearchContext = {
            tema: cleanTema,
            fontes: searchResult.sources,
            repertorio: repertorioResult.repertorio,
            expressoes: expressoesResult.expressoes,
            metadata: {
              researchedAt: new Date().toISOString(),
              reusedSources: searchResult.reusedSources.length,
              newSources: searchResult.newSources.length,
              totalSources: searchResult.sources.length,
              contextVersion: PROMPT_VERSION,
              sourceSnapshot: searchResult.sources.map(s => s.title).join('|'),
            },
          };

          sendEvent('complete', { context });

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendEvent('error', { message: msg });
        } finally {
          await closeBrowser().catch(() => {});
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Error in redacao-pesquisa route:', error);
    return Response.json(
      { error: 'Falha ao processar pesquisa de redação.' },
      { status: 500 }
    );
  }
}
