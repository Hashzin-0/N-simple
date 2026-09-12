import { NextRequest } from 'next/server';
import { SCRAPERS, SCRAPERS_INTERNAL, SearchOptions, searchAllSources } from '@/lib/scrapers';
import { computeTrigonometricSimilarity } from '@/components/PesquisadorAgro/trigonometry';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { decideReuse } from '@/lib/reuseDecision';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';

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

    // ── CAMADA 1: Verificar memória de evidências ──
    const topics = extractTopics(cleanQuery);
    const decision = isSupabaseConfigured()
      ? await decideReuse(cleanQuery, topics)
      : null;

    if (decision && decision.action === 'reuse' && decision.sourcesToReuse.length > 0) {
      const enrichedSources = decision.sourcesToReuse.map(src => ({
        ...src,
        trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
      }));

      enrichedSources.sort(
        (a, b) =>
          (b.trigonometricSimilarity?.cosTheta ?? 0) -
          (a.trigonometricSimilarity?.cosTheta ?? 0)
      );

      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            const sendEvent = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
            };
            sendEvent('memory_hit', {
              decision: 'reuse',
              coverage: decision.coverageScore,
              sources: enrichedSources,
              fromMemory: true,
            });
            sendEvent('complete', { totalFound: enrichedSources.length, fromMemory: true });
            controller.close();
          },
        });
        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      }

      return Response.json({
        sources: enrichedSources,
        query: cleanQuery,
        totalFound: enrichedSources.length,
        errors: [],
        sourcesUsed: [],
        fromMemory: true,
        memoryDecision: {
          action: 'reuse',
          coverage: decision.coverageScore,
          reuseScore: decision.reuseScore,
          explorationNeed: decision.explorationNeed,
          diversity: decision.diversityScore,
        },
      });
    }

    // ── CAMADA 2: Pesquisa web ──
    const topicsToSearch = decision?.action === 'complementary'
      ? decision.topicsNeedingSearch
      : undefined;

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const sendEvent = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
            };

            if (decision && decision.action === 'complementary') {
              sendEvent('memory_partial', {
                decision: 'complementary',
                coverage: decision.coverageScore,
                cachedSources: decision.sourcesToReuse,
                topicsNeedingSearch: decision.topicsNeedingSearch,
              });
            }

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

            // ── CAMADA 3: Indexar novas fontes na memória ──
            if (isSupabaseConfigured() && allSources.length > 0) {
              indexSources(allSources, topics).catch(err =>
                console.warn('[EvidenceIndex] Falha ao indexar:', err)
              );
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

    const result = await searchAllSources(cleanQuery, topicsToSearch, searchOptions);

    const withTrigonometry = result.sources.map((src) => ({
      ...src,
      trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
    }));

    withTrigonometry.sort(
      (a, b) =>
        (b.trigonometricSimilarity?.cosTheta ?? 0) -
        (a.trigonometricSimilarity?.cosTheta ?? 0)
    );

    // Indexar novas fontes na memória
    if (isSupabaseConfigured() && withTrigonometry.length > 0) {
      indexSources(withTrigonometry, topics).catch(err =>
        console.warn('[EvidenceIndex] Falha ao indexar:', err)
      );
    }

    return Response.json({
      sources: withTrigonometry,
      query: cleanQuery,
      totalFound: withTrigonometry.length,
      errors: result.errors,
      sourcesUsed: result.sourcesUsed,
      memoryDecision: decision ? {
        action: decision.action,
        coverage: decision.coverageScore,
        reuseScore: decision.reuseScore,
        explorationNeed: decision.explorationNeed,
        diversity: decision.diversityScore,
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
