import { NextRequest } from 'next/server';
import { SCRAPERS, SCRAPERS_INTERNAL, SCRAPER_CONCURRENCY, SearchOptions } from '@/lib/scrapers';
import { searchSources } from '@/lib/research';
import { ScientificSource } from '@/components/PesquisadorAgro/types';

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

          logMemory('before scrapers (stream)');

          const { understandSources, filterAndRankRelevant } = await import('@/lib/semantic/relevanceEngine');

          // ── Fase 1: Executar scrapers com worker pool, enviar resultados brutos ──
          const rawResultsMap = new Map<string, ScientificSource[]>();
          const scraperErrors: string[] = [];
          let cursor = 0;

          async function scraperWorker() {
            while (cursor < SCRAPERS_INTERNAL.length) {
              const i = cursor++;
              const scraper = SCRAPERS_INTERNAL[i];
              const maxResults = searchOptions.maxPerSource?.[scraper.name] ?? scraper.max;
              sendEvent('scraper_start', { name: scraper.name, maxResults });

              try {
                const rawResults = await scraper.fn(cleanQuery, maxResults, searchOptions.language);
                rawResultsMap.set(scraper.name, rawResults);
                sendEvent('scraper_complete', { name: scraper.name, results: rawResults, count: rawResults.length });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                scraperErrors.push(`${scraper.name}: ${msg}`);
                sendEvent('scraper_error', { name: scraper.name, error: msg });
                rawResultsMap.set(scraper.name, []);
              }
            }
          }

          const workerCount = Math.min(SCRAPER_CONCURRENCY, SCRAPERS_INTERNAL.length);
          await Promise.all(Array.from({ length: workerCount }, () => scraperWorker()));

          logMemory('after scrapers (stream)');

          // ── Fase 2: UnderstandSources uma única vez em todos os resultados combinados ──
          const allRawResults: ScientificSource[] = [];
          for (const results of rawResultsMap.values()) {
            allRawResults.push(...results);
          }

          sendEvent('processing_start', { totalSources: allRawResults.length, message: 'Processando relevância semântica...' });
          logMemory('before understandSources (stream)');

          const understood = await understandSources(cleanQuery, allRawResults);
          const relevant = filterAndRankRelevant(understood);

          logMemory('after understandSources (stream)');
          sendEvent('processing_complete', { processedCount: understood.length, relevantCount: relevant.length });

          sendEvent('complete', {
            totalFound: relevant.length,
            sources: relevant,
            errors: scraperErrors,
          });

          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
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
