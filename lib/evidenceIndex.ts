import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { normalizeTopic, sourceKeyFromTitle } from '@/lib/topicExtractor';
import { computeTrigonometricSimilarity } from '@/components/PesquisadorAgro/trigonometry';

interface IndexedSource {
  id: string;
  source_key: string;
}

/**
 * Calcula a força de evidência de uma fonte para um tópico específico.
 * Usa trigonometric similarity + cobertura de keywords + campos estruturados.
 */
function computeEvidenceStrength(
  source: ScientificSource,
  topic: string
): number {
  const trig = computeTrigonometricSimilarity(topic, source);
  const trigScore = trig?.cosTheta ?? 0.5;

  const topicLower = topic.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let structuralBonus = 0;

  if (topicLower.includes('vantag') && (source.vantagens?.length ?? 0) > 0) {
    structuralBonus += 0.15;
  }
  if (topicLower.includes('desvantag') && (source.desvantagens?.length ?? 0) > 0) {
    structuralBonus += 0.15;
  }
  if (topicLower.includes('caracter') && (source.caracteristicas?.length ?? 0) > 0) {
    structuralBonus += 0.12;
  }

  const keywordText = (source.keywords || []).join(' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const topicTokens = topicLower.split(/[\s_]+/);
  let keywordHits = 0;
  for (const token of topicTokens) {
    if (token.length > 2 && keywordText.includes(token)) keywordHits++;
  }
  if (topicTokens.length > 0) {
    structuralBonus += (keywordHits / topicTokens.length) * 0.1;
  }

  return Math.min(1.0, Math.max(0.0, trigScore + structuralBonus));
}

/**
 * Verifica se uma fonte realmente contém evidência sobre o tópico.
 */
function hasSourceEvidence(
  source: ScientificSource,
  topic: string
): boolean {
  const strength = computeEvidenceStrength(source, topic);
  if (strength >= 0.4) return true;

  const topicLower = topic.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const allText = [
    source.title,
    source.abstract || '',
    (source.keywords || []).join(' '),
    (source.vantagens || []).join(' '),
    (source.desvantagens || []).join(' '),
    (source.caracteristicas || []).join(' '),
  ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const tokens = topicLower.split(/[\s_]+/).filter(t => t.length > 2);
  let matches = 0;
  for (const token of tokens) {
    if (allText.includes(token)) matches++;
  }
  return tokens.length > 0 && (matches / tokens.length) >= 0.5;
}

/**
 * Indexa uma fonte e seus tópicos no Supabase.
 * Faz upsert: se a fonte já existe, atualiza; senão, insere.
 */
export async function indexSource(
  source: ScientificSource,
  topics: string[]
): Promise<IndexedSource | null> {
  if (!isSupabaseConfigured()) return null;

  const key = sourceKeyFromTitle(source.title);

  const { data: existingSource } = await supabase!
    .from('sources')
    .select('id, source_key')
    .eq('source_key', key)
    .single();

  let sourceId: string;

  if (existingSource) {
    sourceId = existingSource.id;
    await supabase!
      .from('sources')
      .update({
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
        last_verified: new Date().toISOString(),
      })
      .eq('id', sourceId);
  } else {
    const { data: inserted, error } = await supabase!
      .from('sources')
      .insert({
        source_key: key,
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
      })
      .select('id, source_key')
      .single();

    if (error || !inserted) {
      console.error('[EvidenceIndex] Erro ao inserir source:', error);
      return null;
    }
    sourceId = inserted.id;
  }

  for (const topic of topics) {
    const normalized = normalizeTopic(topic);
    const evidenceStrength = computeEvidenceStrength(source, topic);
    const hasEvidence = hasSourceEvidence(source, topic);

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
 * Indexa múltiplas fontes em lote.
 */
export async function indexSources(
  sources: ScientificSource[],
  topics: string[]
): Promise<{ indexed: number; errors: number }> {
  let indexed = 0;
  let errors = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(src => indexSource(src, topics))
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        indexed++;
      } else {
        errors++;
      }
    }
  }

  return { indexed, errors };
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
