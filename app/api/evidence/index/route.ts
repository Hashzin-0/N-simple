import { NextRequest } from 'next/server';
import { indexSources, logSearchQuery } from '@/lib/evidenceIndex';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources, UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { closeBrowser } from '@/lib/stealthBrowser';

export const dynamic = 'force-dynamic';

/** Campos que indicam que a fonte já passou pelo motor semântico. */
function isAlreadyUnderstood(src: Record<string, unknown>): boolean {
  return (
    typeof src.semanticScore === 'number' &&
    Array.isArray(src.chunks) &&
    src.chunks.length > 0 &&
    Array.isArray(src.docEmbedding) &&
    (src.docEmbedding as unknown[]).length > 0
  );
}

export async function POST(req: NextRequest) {
  try {
    const { sources, topics, query, decision, coverageScore, alreadyUnderstood } = await req.json();

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

    const sourceArray = sources as Array<ScientificSource & Partial<UnderstoodSource>>;
    const topicArray = (topics as string[]) || [];

    let understood: UnderstoodSource[];

    // Caminho preferido: o orquestrador (searchSources) já entendeu e, em
    // alguns fluxos, já indexou. Se as fontes vêm com campos do motor ou o
    // chamador marcar alreadyUnderstood, NÃO re-entende (evita 2º pipeline
    // completo de embeddings na mesma busca).
    const skipUnderstand =
      alreadyUnderstood === true ||
      sourceArray.every((s) => isAlreadyUnderstood(s as unknown as Record<string, unknown>));

    if (skipUnderstand) {
      understood = sourceArray as unknown as UnderstoodSource[];
    } else {
      if (!query || typeof query !== 'string') {
        return Response.json(
          { error: 'Parâmetro query (string) é obrigatório para o motor semântico entender as fontes antes de indexar.' },
          { status: 400 }
        );
      }
      understood = await understandSources(query, sourceArray);
    }

    const result = await indexSources(understood, topicArray);

    if (typeof decision === 'string' && query) {
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
      skippedUnderstand: skipUnderstand,
    });
  } catch (error: unknown) {
    console.error('[EvidenceIndex] Error:', error);
    return Response.json(
      { error: 'Falha ao indexar fontes na memória de evidências.' },
      { status: 500 }
    );
  } finally {
    await closeBrowser().catch(() => {});
  }
}
