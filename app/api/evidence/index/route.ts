import { NextRequest } from 'next/server';
import { indexSources, logSearchQuery } from '@/lib/evidenceIndex';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources } from '@/lib/semantic/relevanceEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { sources, topics, query, decision, coverageScore } = await req.json();

    if (!isSupabaseConfigured()) {
      return Response.json(
        { error: 'Supabase não configurado. Indexação ignorada.' },
        { status: 200 }
      );
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      return Response.json(
        { error: 'Parâmetro sources (array) é obrigatório.' },
        { status: 400 }
      );
    }

    if (!query || typeof query !== 'string') {
      return Response.json(
        { error: 'Parâmetro query (string) é obrigatório para o motor semântico entender as fontes antes de indexar.' },
        { status: 400 }
      );
    }

    const sourceArray = sources as ScientificSource[];
    const topicArray = (topics as string[]) || [];

    // Reentende cada fonte com a query real antes de decidir o que persistir
    // (relevante para a query, ou fora de tópico mas sobre agro — o resto é
    // descartado dentro de indexSources).
    const understood = await understandSources(query, sourceArray);
    const result = await indexSources(understood, topicArray);

    if (typeof decision === 'string') {
      await logSearchQuery(
        query,
        topicArray,
        sourceArray.length,
        decision,
        typeof coverageScore === 'number' ? coverageScore : 0
      );
    }

    return Response.json({
      indexed: result.indexed,
      archivedOffTopic: result.archivedOffTopic,
      discardedOutOfDomain: result.discardedOutOfDomain,
      errors: result.errors,
      total: sourceArray.length,
    });
  } catch (error: unknown) {
    console.error('[EvidenceIndex] Error:', error);
    return Response.json(
      { error: 'Falha ao indexar fontes na memória de evidências.' },
      { status: 500 }
    );
  }
}
