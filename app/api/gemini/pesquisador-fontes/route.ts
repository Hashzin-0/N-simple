import { NextRequest } from 'next/server';
import { SCRAPERS, SearchOptions } from '@/lib/scrapers';
import { searchSources } from '@/lib/research';

export const dynamic = 'force-dynamic';

function logMemory(label: string) {
  const m = process.memoryUsage();
  console.log(`[MEMORY] ${label}: rss=${Math.round(m.rss / 1024 / 1024)}MB heap=${Math.round(m.heapUsed / 1024 / 1024)}MB external=${Math.round(m.external / 1024 / 1024)}MB`);
}

export async function POST(req: NextRequest) {
  try {
    logMemory('request start');
    const { query, options, stream } = await req.json();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro query de busca é obrigatório.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const searchOptions: SearchOptions = options || {};

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
          };

          sendEvent('start', {
            query: cleanQuery,
            scrapers: SCRAPERS.map(s => ({
              name: s.name,
              maxAllowed: s.maxAllowed,
              description: s.description,
            })),
          });

          logMemory('before searchSources (stream)');

          try {
            // Orquestrador unificado: memória (decideReuse) → reuso →
            // scrapers → understandSources → indexSources (1x só).
            // Substitui o caminho antigo que scrapava+embedava tudo sem memória
            // e forçava o client a re-entender de novo em /api/evidence/index.
            const result = await searchSources({
              query: cleanQuery,
              searchOptions,
              onProgress: {
                onScrapersStart: (scrapers) =>
                  sendEvent('scrapers_config', { scrapers }),
                onScraperStart: (name, maxResults) =>
                  sendEvent('scraper_start', { name, maxResults }),
                onScraperComplete: (name, results) =>
                  sendEvent('scraper_complete', { name, results, count: results.length }),
                onScraperError: (name, error) =>
                  sendEvent('scraper_error', { name, error }),
                onProcessingStart: (totalSources, message) =>
                  sendEvent('processing_start', { totalSources, message }),
                onProcessingComplete: (processedCount, relevantCount) =>
                  sendEvent('processing_complete', { processedCount, relevantCount }),
                onMemoryDecision: (decision) => {
                  if (decision) {
                    sendEvent('memory_decision', {
                      action: decision.action,
                      coverage: decision.coverageScore,
                      reuseScore: decision.reuseScore,
                    });
                  }
                },
              },
            });

            logMemory('after searchSources (stream)');

            sendEvent('complete', {
              totalFound: result.sources.length,
              sources: result.sources,
              errors: result.errors,
              reuseStats: result.memoryDecision
                ? {
                    action: result.memoryDecision.action,
                    coverage: result.memoryDecision.coverageScore,
                    reused: result.reusedSources.length,
                    newFound: result.newSources.length,
                  }
                : null,
              indexingStats: result.indexingStats,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            sendEvent('error', { message: msg });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming path: usa o orquestrador unificado
    logMemory('before searchSources (non-stream)');
    const result = await searchSources({
      query: cleanQuery,
      searchOptions,
    });
    logMemory('after searchSources (non-stream)');

    return Response.json({
      sources: result.sources,
      query: cleanQuery,
      totalFound: result.sources.length,
      errors: result.errors,
      sourcesUsed: [],
      indexingStats: result.indexingStats,
      memoryDecision: result.memoryDecision ? {
        action: result.memoryDecision.action,
        coverage: result.memoryDecision.coverageScore,
        reuseScore: result.memoryDecision.reuseScore,
        explorationNeed: result.memoryDecision.explorationNeed,
        diversity: result.memoryDecision.diversityScore,
      } : null,
    });
  } catch (error: unknown) {
    console.error('Error in pesquisador-fontes route:', error);
    return Response.json(
      { error: 'Falha ao processar pesquisa de fontes científicas.' },
      { status: 500 }
    );
  }
}
