import { NextRequest } from 'next/server';
import { decideReuse } from '@/lib/reuseDecision';
import { extractTopics } from '@/lib/topicExtractor';
import { understandSources, filterAndRankRelevant } from '@/lib/semantic/relevanceEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { query, topics: explicitTopics } = await req.json();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return Response.json(
        { error: 'Parâmetro query é obrigatório.' },
        { status: 400 }
      );
    }

    const topics = explicitTopics?.length > 0
      ? explicitTopics
      : extractTopics(cleanQuery);

    const decision = await decideReuse(cleanQuery, topics);

    // Reentende as fontes de memória com a query exata (motor real, não só
    // o overlap de tópico salvo) e nunca devolve fontes irrelevantes ao cliente.
    const relevantSources = decision.sourcesToReuse.length > 0
      ? filterAndRankRelevant(await understandSources(cleanQuery, decision.sourcesToReuse))
      : [];

    return Response.json({
      query: cleanQuery,
      decision: decision.action,
      coverage: decision.coverageScore,
      reuseScore: decision.reuseScore,
      explorationNeed: decision.explorationNeed,
      diversity: decision.diversityScore,
      sources: relevantSources,
      topicsNeedingSearch: decision.topicsNeedingSearch,
      allTopics: decision.allTopics,
      stats: decision.stats,
    });
  } catch (error: unknown) {
    console.error('[EvidenceSearch] Error:', error);
    return Response.json(
      { error: 'Falha ao consultar memória de evidências.' },
      { status: 500 }
    );
  }
}
