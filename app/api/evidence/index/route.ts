import { NextRequest } from 'next/server';
import { indexSources, logSearchQuery } from '@/lib/evidenceIndex';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { isSupabaseConfigured } from '@/lib/supabase';

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

    const sourceArray = sources as ScientificSource[];
    const topicArray = (topics as string[]) || [];

    const result = await indexSources(sourceArray, topicArray);

    if (query && typeof decision === 'string') {
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
