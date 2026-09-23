import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { embedText, embedTexts, cosineSimilarity, cosineToPercentage } from '@/lib/semantic/embeddings';
import { normalizeTopic } from '@/lib/topicExtractor';
import { SEMANTIC_DISCARD_THRESHOLD } from '@/lib/semantic/config';
import type { QuestionDificuldade, QuestionOrigem, TutorQuestion } from './types';

interface QuestionRow {
  id: string;
  enunciado: string;
  alternativas: Record<string, string> | null;
  gabarito: string | null;
  explicacao: string | null;
  assunto: string;
  subassunto: string | null;
  disciplina: string | null;
  instituicao: string | null;
  ano: number | null;
  tipo_prova: string | null;
  fonte: string | null;
  fonte_url: string | null;
  origem: QuestionOrigem;
  dificuldade: QuestionDificuldade;
  similarity?: number;
}

function rowToQuestion(row: QuestionRow): TutorQuestion {
  return {
    id: row.id,
    enunciado: row.enunciado,
    alternativas: row.alternativas,
    gabarito: row.gabarito,
    explicacao: row.explicacao,
    assunto: row.assunto,
    subassunto: row.subassunto,
    disciplina: row.disciplina,
    instituicao: row.instituicao,
    ano: row.ano,
    tipo_prova: row.tipo_prova,
    fonte: row.fonte,
    fonte_url: row.fonte_url,
    origem: row.origem,
    dificuldade: row.dificuldade,
    similarity: row.similarity,
  };
}

/**
 * Hash determinístico do enunciado normalizado para deduplicação.
 */
export function questionHash(enunciado: string): string {
  const normalized = (enunciado || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  let h1 = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h1 ^= normalized.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  let h2 = 0x811c9dc5;
  for (let i = normalized.length - 1; i >= 0; i--) {
    h2 ^= normalized.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `q_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}_${normalized.length}`;
}

export interface SearchQuestionsOptions {
  query: string;
  assunto?: string;
  dificuldade?: QuestionDificuldade;
  excludeIds?: string[];
  limit?: number;
  threshold?: number;
}

/**
 * Busca questões por embedding (RPC pgvector) com fallback por tópico.
 */
export async function searchQuestions(opts: SearchQuestionsOptions): Promise<TutorQuestion[]> {
  if (!isSupabaseConfigured()) return [];

  const limit = opts.limit ?? 8;
  const threshold = (opts.threshold ?? 35) / 100;
  const excludeIds = opts.excludeIds ?? [];

  try {
    const queryEmbedding = await embedText(
      [opts.assunto, opts.query].filter(Boolean).join(' — '),
      'RETRIEVAL_QUERY'
    );
    const { data, error } = await supabase!.rpc('match_questions_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      exclude_ids: excludeIds.length > 0 ? excludeIds : null,
    });

    if (!error && data && data.length > 0) {
      return (data as QuestionRow[]).map(rowToQuestion);
    }
  } catch (err) {
    console.warn('[QuestionBank] Busca vetorial falhou, tentando por tópico:', err);
  }

  // Fallback: busca por tópico textual
  try {
    const topic = opts.assunto || opts.query;
    const { data, error } = await supabase!.rpc('search_questions_by_topic', {
      search_topic: topic,
      match_count: limit,
      exclude_ids: excludeIds.length > 0 ? excludeIds : null,
    });
    if (!error && data) {
      return (data as QuestionRow[]).map(rowToQuestion);
    }
  } catch (err) {
    console.warn('[QuestionBank] Busca por tópico falhou:', err);
  }

  return [];
}

/**
 * Conta quantas questões já existem para um tema (para decidir reuso vs pesquisa).
 */
export async function countQuestionsForTopic(tema: string, subtema?: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const terms = [tema, subtema].filter(Boolean) as string[];

  try {
    let query = supabase!.from('questions').select('id', { count: 'exact', head: true });
    for (const term of terms) {
      query = query.or(`assunto.ilike.%${term}%,subassunto.ilike.%${term}%`);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export interface InsertQuestionsResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

/**
 * Insere questões com dedup por hash + gera embedding + indexa tópicos.
 */
export async function insertQuestions(
  questions: Array<Omit<TutorQuestion, 'id' | 'similarity'>>,
  topics: string[]
): Promise<InsertQuestionsResult> {
  if (!isSupabaseConfigured() || questions.length === 0) {
    return { inserted: 0, duplicates: 0, errors: 0 };
  }

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  const valid = questions.filter((q) => (q.enunciado || '').trim().length > 10);
  if (valid.length === 0) return { inserted: 0, duplicates: 0, errors: 0 };

  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(valid.map((q) => `${q.assunto}: ${q.enunciado}`));
  } catch (err) {
    console.warn('[QuestionBank] Falha ao gerar embeddings, salvando sem vetor:', err);
  }

  for (let i = 0; i < valid.length; i++) {
    const q = valid[i];
    const hash = questionHash(q.enunciado);

    try {
      const { data: existing } = await supabase!
        .from('questions')
        .select('id')
        .eq('hash_dedup', hash)
        .maybeSingle();

      if (existing) {
        duplicates++;
        await supabase!.from('questions').update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
        continue;
      }

      const embedding = embeddings[i] && embeddings[i].length > 0 ? embeddings[i] : null;
      const { data: insertedRow, error } = await supabase!
        .from('questions')
        .insert({
          hash_dedup: hash,
          enunciado: q.enunciado,
          alternativas: q.alternativas ?? null,
          gabarito: q.gabarito ?? null,
          explicacao: q.explicacao ?? null,
          assunto: q.assunto,
          subassunto: q.subassunto ?? null,
          disciplina: q.disciplina ?? null,
          instituicao: q.instituicao ?? null,
          ano: q.ano ?? null,
          tipo_prova: q.tipo_prova ?? null,
          fonte: q.fonte ?? null,
          fonte_url: q.fonte_url ?? null,
          origem: q.origem,
          dificuldade: q.dificuldade,
          embedding,
        })
        .select('id')
        .single();

      if (error || !insertedRow) {
        errors++;
        continue;
      }
      inserted++;

      // Indexa tópicos da sessão + assunto/subassunto
      const topicSet = new Set<string>([
        ...topics,
        q.assunto,
        ...(q.subassunto ? [q.subassunto] : []),
      ]);

      let strength = 0.5;
      if (embedding) {
        for (const topic of topicSet) {
          try {
            const topicEmb = await embedText(topic.replace(/_/g, ' '));
            const cos = cosineSimilarity(topicEmb, embedding);
            const s = cosineToPercentage(cos) / 100;
            if (s * 100 > SEMANTIC_DISCARD_THRESHOLD) strength = s;
            await supabase!.from('question_topics').upsert(
              {
                question_id: insertedRow.id,
                topic,
                topic_normalized: normalizeTopic(topic),
                evidence_strength: s,
              },
              { onConflict: 'question_id,topic_normalized' }
            );
          } catch {
            // segue sem strength
          }
        }
      } else {
        for (const topic of topicSet) {
          await supabase!.from('question_topics').upsert(
            {
              question_id: insertedRow.id,
              topic,
              topic_normalized: normalizeTopic(topic),
              evidence_strength: strength,
            },
            { onConflict: 'question_id,topic_normalized' }
          );
        }
      }
    } catch (err) {
      console.warn('[QuestionBank] Erro ao inserir questão:', err);
      errors++;
    }
  }

  return { inserted, duplicates, errors };
}
