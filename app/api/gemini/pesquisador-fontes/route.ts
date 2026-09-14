import { NextRequest } from 'next/server';
import { SCRAPERS, SCRAPERS_INTERNAL, SearchOptions, searchAllSources } from '@/lib/scrapers';
import { decideReuse } from '@/lib/reuseDecision';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources, filterAndRankRelevant } from '@/lib/semantic/relevanceEngine';

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

    // ── ≥75% de cobertura: reutiliza sem precisar pesquisar fontes novas ──
    if (decision && decision.action === 'reuse' && decision.sourcesToReuse.length > 0) {
      const understood = await understandSources(cleanQuery, decision.sourcesToReuse);
      const relevant = filterAndRankRelevant(understood);

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
              sources: relevant,
              fromMemory: true,
            });
            sendEvent('complete', { totalFound: relevant.length, fromMemory: true });
            controller.close();
          },
        });
        return new Response(readable, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        });
      }

      return Response.json({
        sources: relevant,
        query: cleanQuery,
        totalFound: relevant.length,
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

    // ── 45%-75% (complementary) ou <45% (new_search): pesquisa fontes novas.
    // No caso "complementary", isso serve de CONTRAPONTO às fontes reutilizadas
    // (mesmo tópicos já cobertos são pesquisados de novo para validação cruzada).
    const isComplementary = decision?.action === 'complementary';
    const topicsToSearch = decision?.action === 'complementary' || decision?.action === 'new_search'
      ? decision.topicsNeedingSearch
      : undefined;

    // Fontes reutilizadas (já reentendidas com a query atual) para contraponto.
    const reusedUnderstood = isComplementary && decision
      ? filterAndRankRelevant(await understandSources(cleanQuery, decision.sourcesToReuse))
      : [];

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const sendEvent = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
            };

            if (isComplementary) {
              sendEvent('memory_partial', {
                decision: 'complementary',
                coverage: decision!.coverageScore,
                cachedSources: reusedUnderstood,
                topicsNeedingSearch: decision!.topicsNeedingSearch,
                note: 'Fontes reutilizadas mostradas como contraponto às pesquisadas agora.',
              });
            }

            sendEvent('start', { query: cleanQuery, scrapers: SCRAPERS.map(s => ({ name: s.name, maxAllowed: s.maxAllowed, description: s.description })) });

            const allResults = await Promise.allSettled(
              SCRAPERS_INTERNAL.map(async (scraper) => {
                const maxResults = searchOptions.maxPerSource?.[scraper.name] ?? scraper.max;
                sendEvent('scraper_start', { name: scraper.name, maxResults });

                try {
                  const rawResults = await scraper.fn(cleanQuery, maxResults, searchOptions.language);

                  // ── Motor semântico: lê, entende e pontua cada fonte de verdade ──
                  const understood = await understandSources(cleanQuery, rawResults);
                  const relevant = filterAndRankRelevant(understood);

                  sendEvent('scraper_complete', { name: scraper.name, results: relevant, count: relevant.length });
                  return { name: scraper.name, understood };
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  sendEvent('scraper_error', { name: scraper.name, error: msg });
                  return { name: scraper.name, understood: [] };
                }
              })
            );

            const allUnderstood: Awaited<ReturnType<typeof understandSources>> = [];
            for (const result of allResults) {
              if (result.status === 'fulfilled') {
                allUnderstood.push(...result.value.understood);
              }
            }

            // ── Indexa TODAS as fontes entendidas (a regra de persistência —
            // relevante para a query, ou fora de tópico mas sobre agro — é
            // aplicada dentro de indexSources; o resto é descartado). ──
            if (isSupabaseConfigured() && allUnderstood.length > 0) {
              indexSources(allUnderstood, topics).catch(err =>
                console.warn('[EvidenceIndex] Falha ao indexar:', err)
              );
            }

            const totalRelevant = filterAndRankRelevant(allUnderstood).length + reusedUnderstood.length;
            sendEvent('complete', { totalFound: totalRelevant });

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

    // ── Motor semântico: lê, entende e pontua cada fonte de verdade ──
    const understood = await understandSources(cleanQuery, result.sources);
    const relevantNew = filterAndRankRelevant(understood);

    // Indexa tudo (relevantes + fora-de-tópico-mas-agro; o resto é descartado dentro).
    if (isSupabaseConfigured() && understood.length > 0) {
      indexSources(understood, topics).catch(err =>
        console.warn('[EvidenceIndex] Falha ao indexar:', err)
      );
    }

    // Combina contraponto (reutilizadas) + novas, sem duplicar por título.
    const seenTitles = new Set(reusedUnderstood.map(s => s.title));
    const combined = [
      ...reusedUnderstood,
      ...relevantNew.filter(s => !seenTitles.has(s.title)),
    ].sort((a, b) => b.semanticScore - a.semanticScore);

    return Response.json({
      sources: combined,
      query: cleanQuery,
      totalFound: combined.length,
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
