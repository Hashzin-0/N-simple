import { NextRequest } from 'next/server';
import { SCRAPERS, SCRAPERS_INTERNAL, SearchOptions, searchAllSources } from '@/lib/scrapers';
import { computeTrigonometricSimilarity } from '@/components/PesquisadorAgro/trigonometry';
import { ScientificSource } from '@/components/PesquisadorAgro/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
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
          try {
            const sendEvent = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
            };

            sendEvent('start', { query: cleanQuery, scrapers: SCRAPERS.map(s => ({ name: s.name, maxAllowed: s.maxAllowed, description: s.description })) });

            const allResults = await Promise.allSettled(
              SCRAPERS_INTERNAL.map(async (scraper) => {
                const maxResults = searchOptions.maxPerSource?.[scraper.name] ?? scraper.max;
                sendEvent('scraper_start', { name: scraper.name, maxResults });

                try {
                  const results = await scraper.fn(cleanQuery, maxResults, searchOptions.language);
                  const withTrigonometry = results.map((src) => ({
                    ...src,
                    trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
                  }));
                  sendEvent('scraper_complete', { name: scraper.name, results: withTrigonometry, count: withTrigonometry.length });
                  return { name: scraper.name, results: withTrigonometry };
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  sendEvent('scraper_error', { name: scraper.name, error: msg });
                  return { name: scraper.name, results: [] };
                }
              })
            );

            const allSources: (ScientificSource & { trigonometricSimilarity: ReturnType<typeof computeTrigonometricSimilarity> })[] = [];
            for (const result of allResults) {
              if (result.status === 'fulfilled') {
                allSources.push(...result.value.results);
              }
            }

            sendEvent('complete', { totalFound: allSources.length });

            controller.close();
          } catch (err) {
            controller.error(err);
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
    }

    const result = await searchAllSources(cleanQuery, undefined, searchOptions);

    const withTrigonometry = result.sources.map((src) => ({
      ...src,
      trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
    }));

    withTrigonometry.sort(
      (a, b) =>
        (b.trigonometricSimilarity?.cosTheta ?? 0) -
        (a.trigonometricSimilarity?.cosTheta ?? 0)
    );

    return Response.json({
      sources: withTrigonometry,
      query: cleanQuery,
      totalFound: withTrigonometry.length,
      errors: result.errors,
      sourcesUsed: result.sourcesUsed,
    });
  } catch (error: unknown) {
    console.error('Error in pesquisador-fontes route:', error);
    return Response.json(
      { error: 'Falha ao processar pesquisa de fontes científicas.' },
      { status: 500 }
    );
  }
}
