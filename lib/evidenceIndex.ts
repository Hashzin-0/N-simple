import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { normalizeTopic, sourceKeyFromTitle } from '@/lib/topicExtractor';
import { UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { embedTexts, cosineSimilarity, cosineToPercentage } from '@/lib/semantic/embeddings';
import { SEMANTIC_DISCARD_THRESHOLD } from '@/lib/semantic/config';

interface IndexedSource {
  id: string;
  source_key: string;
}

/**
 * Força de evidência de uma fonte para um tópico específico, calculada
 * por similaridade de embedding real (docEmbedding da fonte vs. embedding
 * do tópico) — não mais por overlap de substring. Retorna 0-1.
 *
 * @param topicEmbedding Vetor do tópico já calculado (memoizado pelo caller)
 */
function computeEvidenceStrength(
  source: UnderstoodSource,
  topicEmbedding: number[]
): number {
  if (!source.docEmbedding || source.docEmbedding.length === 0) {
    return 0;
  }
  const cos = cosineSimilarity(topicEmbedding, source.docEmbedding);
  return cosineToPercentage(cos) / 100;
}

/**
 * Pré-calcula o embedding de cada tópico UMA vez (batch), em vez de
 * embedText(topic) dentro do loop fonte×tópico (N×M chamadas idênticas).
 */
async function buildTopicEmbeddings(topics: string[]): Promise<Map<string, number[]>> {
  const unique = [...new Set(topics.map((t) => t.replace(/_/g, ' ')))];
  const map = new Map<string, number[]>();
  if (unique.length === 0) return map;
  try {
    const vectors = await embedTexts(unique, 'RETRIEVAL_DOCUMENT');
    unique.forEach((t, i) => map.set(t, vectors[i]));
  } catch (err) {
    console.warn('[EvidenceIndex] Falha ao embedar tópicos em lote:', err);
  }
  return map;
}

/**
 * Indexa uma fonte JÁ ENTENDIDA pelo motor semântico (embedding, chunks,
 * categorias, score) no Supabase. Faz upsert na fonte, substitui seus
 * chunks/categorias, e grava a força de evidência por tópico usando
 * similaridade de embedding real.
 *
 * Regra de persistência (definida pelo usuário):
 *  - semanticScore > 45 (relevante para a query): sempre salva.
 *  - semanticScore <= 45 (irrelevante para a query): salva MESMO ASSIM
 *    se a fonte for sobre agronegócio/agropecuária em geral (inAgroDomain),
 *    para virar base de conhecimento reaproveitável no futuro — mas nunca
 *    é retornada ao usuário nesta busca (isso é filtrado por
 *    `filterAndRankRelevant`, que olha só `discarded`, não `shouldPersist`).
 *  - Fora do domínio agro E irrelevante para a query: descartada por
 *    completo, nunca chega ao banco.
 */
export async function indexSource(
  source: UnderstoodSource,
  topics: string[],
  topicEmbeddings?: Map<string, number[]>
): Promise<IndexedSource | null> {
  if (!isSupabaseConfigured()) return null;

  if (!source.shouldPersist) {
    return null;
  }

  const key = sourceKeyFromTitle(source.title);

  const { data: existingSource } = await supabase!
    .from('sources')
    .select('id, source_key')
    .eq('source_key', key)
    .single();

  let sourceId: string;

  const sharedFields = {
    title: source.title,
    authors: source.authors,
    year: source.year,
    publication: source.publication,
    source_name: source.sourceName,
    source_type: source.sourceType,
    abstract: source.abstract,
    keywords: source.keywords,
    direct_url: source.directUrl,
    search_url: source.searchUrl,
    doi: source.doi,
    abnt_citation: source.abntCitation,
    vantagens: source.vantagens || [],
    desvantagens: source.desvantagens || [],
    caracteristicas: source.caracteristicas || [],
    embedding: source.docEmbedding && source.docEmbedding.length > 0 ? source.docEmbedding : null,
    semantic_score: source.semanticScore,
    used_full_text: source.usedFullText,
    best_excerpt: source.bestExcerpt || null,
    domain_score: source.domainScore,
    in_agro_domain: source.inAgroDomain,
  };

  if (existingSource) {
    sourceId = existingSource.id;
    await supabase!
      .from('sources')
      .update({ ...sharedFields, last_verified: new Date().toISOString() })
      .eq('id', sourceId);
  } else {
    const { data: inserted, error } = await supabase!
      .from('sources')
      .insert({ source_key: key, ...sharedFields })
      .select('id, source_key')
      .single();

    if (error || !inserted) {
      console.error('[EvidenceIndex] Erro ao inserir source:', error);
      return null;
    }
    sourceId = inserted.id;
  }

  // Substitui os chunks e categorias (índice de reuso rápido) desta fonte.
  await supabase!.from('source_chunks').delete().eq('source_id', sourceId);
  if (source.chunks.length > 0) {
    await supabase!.from('source_chunks').insert(
      source.chunks.map((chunk, idx) => ({
        source_id: sourceId,
        chunk_index: idx,
        chunk_text: chunk.text,
        embedding: chunk.embedding,
      }))
    );
  }

  await supabase!.from('source_categories').delete().eq('source_id', sourceId);
  if (source.semanticCategories.length > 0) {
    await supabase!.from('source_categories').insert(
      source.semanticCategories.map((cat) => ({
        source_id: sourceId,
        label: cat.label,
        score: cat.score,
      }))
    );
  }

  // Força de evidência por tópico da busca (via embedding pré-calculado).
  const localTopicEmbeddings =
    topicEmbeddings ?? (await buildTopicEmbeddings(topics));
  for (const topic of topics) {
    const normalized = normalizeTopic(topic);
    const emb = localTopicEmbeddings.get(topic.replace(/_/g, ' '));
    const evidenceStrength = emb ? computeEvidenceStrength(source, emb) : 0;
    const hasEvidence = evidenceStrength * 100 > SEMANTIC_DISCARD_THRESHOLD;

    await supabase!
      .from('source_topics')
      .upsert(
        {
          source_id: sourceId,
          topic,
          topic_normalized: normalized,
          evidence_strength: evidenceStrength,
          has_evidence: hasEvidence,
        },
        { onConflict: 'source_id,topic_normalized' }
      );
  }

  return { id: sourceId, source_key: key };
}

/**
 * Indexa múltiplas fontes (já entendidas pelo motor semântico) em lote.
 *  - `indexed`: relevantes para a query, salvas E mostráveis ao usuário.
 *  - `archivedOffTopic`: irrelevantes para esta query mas sobre agro —
 *    salvas no banco (base futura), NUNCA mostradas nesta busca.
 *  - `discardedOutOfDomain`: fora do domínio agro inteiro — nunca salvas.
 *  - `errors`: falha de gravação.
 */
export async function indexSources(
  sources: UnderstoodSource[],
  topics: string[]
): Promise<{ indexed: number; archivedOffTopic: number; discardedOutOfDomain: number; errors: number }> {
  let indexed = 0;
  let archivedOffTopic = 0;
  let discardedOutOfDomain = 0;
  let errors = 0;

  // Embeddings de tópico calculados 1x para o lote inteiro (antes: N×M).
  const topicEmbeddings = await buildTopicEmbeddings(topics);

  const BATCH_SIZE = 10;
  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (src) => {
        if (!src.shouldPersist) return 'discardedOutOfDomain' as const;
        const result = await indexSource(src, topics, topicEmbeddings);
        if (!result) return 'error' as const;
        return src.discarded ? ('archivedOffTopic' as const) : ('indexed' as const);
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value === 'indexed') indexed++;
        else if (result.value === 'archivedOffTopic') archivedOffTopic++;
        else if (result.value === 'discardedOutOfDomain') discardedOutOfDomain++;
        else errors++;
      } else {
        errors++;
      }
    }
  }

  return { indexed, archivedOffTopic, discardedOutOfDomain, errors };
}

/**
 * Incrementa o contador de reutilização de uma fonte.
 */
export async function incrementReuseCount(sourceId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const { data } = await supabase!
      .from('sources')
      .select('reuse_count')
      .eq('id', sourceId)
      .single();

    if (data) {
      await supabase!
        .from('sources')
        .update({ reuse_count: (data.reuse_count || 0) + 1 })
        .eq('id', sourceId);
    }
  } catch {
    // ignore
  }
}

/**
 * Registra uma query de pesquisa no log.
 */
export async function logSearchQuery(
  query: string,
  topics: string[],
  sourcesFound: number,
  decision: string,
  coverageScore: number
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await supabase!
    .from('search_queries')
    .insert({
      query_text: query,
      query_normalized: normalizeTopic(query),
      topics,
      sources_found: sourcesFound,
      decision,
      coverage_score: coverageScore,
    });
}
