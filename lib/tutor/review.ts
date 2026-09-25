import { generateTextWithFallback } from '@/lib/llm-providers';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getDocumentsContext, queryDocuments } from './documents';

export type ReviewKind =
  | 'simulado'
  | 'quiz'
  | 'mapa_mental'
  | 'seminario'
  | 'resumo'
  | 'plano'
  | 'flashcards';

export type Dificuldade = 'facil' | 'media' | 'dificil';

export interface ReviewQuestion {
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  dificuldade: Dificuldade;
}

export interface SimuladoPayload {
  titulo: string;
  tema: string;
  dificuldade: Dificuldade | 'mista';
  fonte: 'documento' | 'tema' | 'misto';
  questoes: ReviewQuestion[];
}

export interface MapaMentalNode {
  label: string;
  filhos: MapaMentalNode[];
}

export interface MapaMentalPayload {
  titulo: string;
  raiz: string;
  arvore: MapaMentalNode[];
}

export interface SeminarioItem {
  titulo: string;
  pontos: string[];
  tempoMin: number;
}

export interface SeminarioPayload {
  titulo: string;
  duracaoMin: number;
  objetivo: string;
  itens: SeminarioItem[];
}

export interface ResumoTopico {
  titulo: string;
  texto: string;
}

export interface ResumoPayload {
  titulo: string;
  topicoSumario: string;
  topicos: ResumoTopico[];
  conceitosChave: string[];
}

export interface PlanoDia {
  dia: number;
  foco: string;
  atividades: string[];
  tempoMin: number;
}

export interface PlanoPayload {
  titulo: string;
  duracaoDias: number;
  meta: string;
  dias: PlanoDia[];
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  topic: string;
}

export interface ReviewRequest {
  kind: ReviewKind;
  tema: string;
  subtema?: string;
  quantidade?: number;
  dificuldade?: Dificuldade;
  documentIds?: string[];
  userId?: string | null;
}

export interface ReviewResult {
  kind: ReviewKind;
  topic: string;
  payload: unknown;
  artifactId: string | null;
  flashcardIds?: string[];
  fonte: 'documento' | 'tema' | 'misto' | 'nenhuma';
}

const DEFAULT_QTD: Record<string, number> = {
  simulado: 10,
  quiz: 8,
  flashcards: 12,
};

const MAX_QTD = 20;
const MAX_CHUNKS_FOR_PROMPT = 10;
const MAX_EXCERPT_CHARS = 14_000;

async function buildReviewContext(req: ReviewRequest): Promise<{
  docSection: string;
  hasDocs: boolean;
  documentIds: string[];
}> {
  const { documents } = await getDocumentsContext(req.userId ?? null);
  const selected =
    req.documentIds && req.documentIds.length > 0
      ? documents.filter((d) => req.documentIds!.includes(d.id))
      : documents;
  const documentIds = selected.map((d) => d.id);

  let docSection = '';
  if (selected.length > 0) {
    const query = [req.tema, req.subtema].filter(Boolean).join(' ').trim();
    const chunks = await queryDocuments(
      documentIds,
      query || 'conceitos principais do material',
      MAX_CHUNKS_FOR_PROMPT
    );
    const excerpts = chunks
      .map((c, i) => `[Trecho ${i + 1}] ${c.text}`)
      .join('\n\n')
      .slice(0, MAX_EXCERPT_CHARS);
    // contexto compacto já vem com todos os docs; se houver filtro, restringe ao resumo dos selecionados
    const digests = selected
      .map((d) =>
        `- "${d.name}": ${d.digest?.resumo || '(sem resumo)'}${
          d.digest?.topicos?.length ? ` (tópicos: ${d.digest.topicos.join(', ')})` : ''
        }`
      )
      .join('\n');
    docSection = [
      '=== MATERIAL DO ALUNO (fonte primária) ===',
      digests,
      excerpts ? `\n=== TRECHOS DO MATERIAL ===\n${excerpts}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return { docSection, hasDocs: selected.length > 0, documentIds };
}

function jsonInstruction(schemaExample: unknown): string {
  return [
    '',
    'Responda APENAS com um JSON válido (sem markdown, sem comentários) no formato:',
    JSON.stringify(schemaExample, null, 2),
  ].join('\n');
}

function buildPrompt(req: ReviewRequest, docSection: string): string {
  const tema = [req.tema, req.subtema].filter(Boolean).join(' — ') || 'agronomia em geral';
  const dif = req.dificuldade ?? 'media';
  const qtd = Math.min(req.quantidade ?? DEFAULT_QTD[req.kind] ?? 8, MAX_QTD);
  const base = `Você é um tutor de agronomia e ciências agrárias (nível universitário, pt-BR).
Tema: ${tema}. Dificuldade: ${dif}.
${docSection ? `${docSection}\n\nSe o material do aluno estiver acima, use-o como FONTE PRIMÁRIA (priorize conceitos, dados e exemplos dele). Caso contrário, use seu conhecimento técnico confiável.` : 'Não há material enviado — use seu conhecimento técnico confiável sobre o tema.'}`;

  switch (req.kind) {
    case 'simulado':
      return (
        base +
        `\nGere um simulado com ${qtd} questões de múltipla escolha (4 alternativas, exatamente 1 correta), cobrindo diferentes ângulos do tema.` +
        jsonInstruction({
          titulo: 'string',
          tema: 'string',
          dificuldade: dif,
          fonte: 'documento | tema | misto',
          questoes: [
            {
              enunciado: 'string',
              alternativas: ['A', 'B', 'C', 'D'],
              correta: 0,
              explicacao: 'string (por que a correta está correta e as outras não)',
              dificuldade: 'facil | media | dificil',
            },
          ],
        })
      );

    case 'quiz':
      return (
        base +
        `\nGere um quiz rápido de ${qtd} perguntas de múltipla escolha (4 alternativas, 1 correta), focado nos pontos mais importantes do tema.` +
        jsonInstruction({
          titulo: 'string',
          tema: 'string',
          dificuldade: dif,
          fonte: 'documento | tema | misto',
          questoes: [
            {
              enunciado: 'string',
              alternativas: ['A', 'B', 'C', 'D'],
              correta: 0,
              explicacao: 'string',
              dificuldade: 'facil | media | dificil',
            },
          ],
        })
      );

    case 'mapa_mental':
      return (
        base +
        `\nGere um mapa mental do tema: raiz + 4–6 ramos principais, cada um com 2–4 sub-ramos (máximo 3 níveis).` +
        jsonInstruction({
          titulo: 'string',
          raiz: 'string',
          arvore: [
            {
              label: 'ramo principal',
              filhos: [{ label: 'sub-ramo', filhos: [{ label: 'folha', filhos: [] }] }],
            },
          ],
        })
      );

    case 'seminario':
      return (
        base +
        `\nGere um roteiro de seminário (${Math.max(10, qtd * 5)} min): objetivo, 4–6 blocos com tópicos e tempo sugerido (soma ≈ duração total).` +
        jsonInstruction({
          titulo: 'string',
          duracaoMin: 20,
          objetivo: 'string',
          itens: [{ titulo: 'string', pontos: ['string'], tempoMin: 5 }],
        })
      );

    case 'resumo':
      return (
        base +
        `\nGere um material de revisão: sumário de 2–3 frases, 4–8 tópicos (título + texto denso de 3–6 frases) e lista de conceitos-chave.` +
        jsonInstruction({
          titulo: 'string',
          topicoSumario: 'string',
          topicos: [{ titulo: 'string', texto: 'string' }],
          conceitosChave: ['string'],
        })
      );

    case 'plano':
      return (
        base +
        `\nGere um plano de estudos de 7 dias para dominar o tema: foco diário, 3–5 atividades concretas e tempo estimado por dia.` +
        jsonInstruction({
          titulo: 'string',
          duracaoDias: 7,
          meta: 'string',
          dias: [{ dia: 1, foco: 'string', atividades: ['string'], tempoMin: 45 }],
        })
      );

    case 'flashcards':
      return (
        base +
        `\nGere ${qtd} flashcards (frente = pergunta curta ou termo; verso = resposta precisa de 1–3 frases) cobrindo o tema.` +
        jsonInstruction({
          cards: [{ front: 'string', back: 'string', topic: 'string' }],
        })
      );
  }
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('A IA não retornou JSON válido. Tente novamente.');
  return JSON.parse(match[0]);
}

function normalizeAlternativas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v)).filter((v) => v.trim().length > 0);
}

function normalizeQuestions(raw: unknown): ReviewQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => {
      const obj = (q ?? {}) as Record<string, unknown>;
      const alternativas = normalizeAlternativas(obj.alternativas);
      const corretaNum = Number(obj.correta);
      const dificuldade =
        obj.dificuldade === 'facil' || obj.dificuldade === 'dificil'
          ? obj.dificuldade
          : 'media';
      return {
        enunciado: String(obj.enunciado ?? '').trim(),
        alternativas,
        correta:
          Number.isInteger(corretaNum) && corretaNum >= 0 && corretaNum < alternativas.length
            ? corretaNum
            : 0,
        explicacao: String(obj.explicacao ?? '').trim(),
        dificuldade: dificuldade as Dificuldade,
      };
    })
    .filter((q) => q.enunciado.length > 0 && q.alternativas.length >= 2);
}

function normalizeMapa(raw: unknown): MapaMentalPayload {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const normalizeNode = (n: unknown): MapaMentalNode | null => {
    const no = (n ?? {}) as Record<string, unknown>;
    const label = String(no.label ?? '').trim();
    if (!label) return null;
    const filhos = Array.isArray(no.filhos)
      ? no.filhos.map(normalizeNode).filter((n2): n2 is MapaMentalNode => n2 !== null)
      : [];
    return { label, filhos };
  };
  const arvore = Array.isArray(obj.arvore)
    ? obj.arvore.map(normalizeNode).filter((n): n is MapaMentalNode => n !== null)
    : [];
  return {
    titulo: String(obj.titulo ?? 'Mapa mental').trim(),
    raiz: String(obj.raiz ?? '').trim() || 'Tema',
    arvore,
  };
}

function normalizeSeminario(raw: unknown, tema: string): SeminarioPayload {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const itens: SeminarioItem[] = Array.isArray(obj.itens)
    ? obj.itens
        .map((i) => {
          const it = (i ?? {}) as Record<string, unknown>;
          return {
            titulo: String(it.titulo ?? '').trim(),
            pontos: Array.isArray(it.pontos)
              ? it.pontos.map((p) => String(p)).filter((p) => p.trim().length > 0)
              : [],
            tempoMin: Math.max(1, Number(it.tempoMin) || 5),
          };
        })
        .filter((i) => i.titulo.length > 0)
    : [];
  return {
    titulo: String(obj.titulo ?? '').trim() || `Seminário — ${tema}`,
    duracaoMin: Math.max(5, Number(obj.duracaoMin) || 20),
    objetivo: String(obj.objetivo ?? '').trim(),
    itens,
  };
}

function normalizeResumo(raw: unknown, tema: string): ResumoPayload {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const topicos: ResumoTopico[] = Array.isArray(obj.topicos)
    ? obj.topicos
        .map((t) => {
          const to = (t ?? {}) as Record<string, unknown>;
          return {
            titulo: String(to.titulo ?? '').trim(),
            texto: String(to.texto ?? '').trim(),
          };
        })
        .filter((t) => t.titulo && t.texto)
    : [];
  return {
    titulo: String(obj.titulo ?? '').trim() || `Revisão — ${tema}`,
    topicoSumario: String(obj.topicoSumario ?? '').trim(),
    topicos,
    conceitosChave: Array.isArray(obj.conceitosChave)
      ? obj.conceitosChave.map((c) => String(c)).filter((c) => c.trim().length > 0)
      : [],
  };
}

function normalizePlano(raw: unknown, tema: string): PlanoPayload {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const dias: PlanoDia[] = Array.isArray(obj.dias)
    ? obj.dias
        .map((d) => {
          const di = (d ?? {}) as Record<string, unknown>;
          return {
            dia: Number(di.dia) || 0,
            foco: String(di.foco ?? '').trim(),
            atividades: Array.isArray(di.atividades)
              ? di.atividades.map((a) => String(a)).filter((a) => a.trim().length > 0)
              : [],
            tempoMin: Math.max(10, Number(di.tempoMin) || 30),
          };
        })
        .filter((d) => d.foco)
    : [];
  return {
    titulo: String(obj.titulo ?? '').trim() || `Plano de estudos — ${tema}`,
    duracaoDias: Math.max(1, Number(obj.duracaoDias) || dias.length || 7),
    meta: String(obj.meta ?? '').trim(),
    dias,
  };
}

function normalizeFlashcards(raw: unknown, tema: string): GeneratedFlashcard[] {
  const arr = Array.isArray(raw)
    ? raw
    : ((raw ?? {}) as Record<string, unknown>).cards;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c) => {
      const co = (c ?? {}) as Record<string, unknown>;
      return {
        front: String(co.front ?? '').trim(),
        back: String(co.back ?? '').trim(),
        topic: String(co.topic ?? '').trim() || tema,
      };
    })
    .filter((c) => c.front.length > 0 && c.back.length > 0);
}

async function persistArtifact(
  req: ReviewRequest,
  kind: Exclude<ReviewKind, 'flashcards'>,
  payload: unknown,
  fonte: ReviewResult['fonte']
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase!
      .from('review_artifacts')
      .insert({
        user_id: req.userId ?? null,
        kind,
        topic: [req.tema, req.subtema].filter(Boolean).join(' — ') || null,
        payload: { ...((payload as Record<string, unknown>) ?? {}), fonte },
      })
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[TutorReview] falha ao persistir artefato:', error?.message);
      return null;
    }
    return data.id as string;
  } catch (err) {
    console.warn('[TutorReview] falha ao persistir artefato:', err);
    return null;
  }
}

async function persistFlashcards(
  req: ReviewRequest,
  cards: GeneratedFlashcard[]
): Promise<string[]> {
  if (!isSupabaseConfigured() || cards.length === 0) return [];
  try {
    const rows = cards.map((c) => ({
      user_id: req.userId ?? 'anon',
      topic: c.topic,
      front: c.front,
      back: c.back,
    }));
    const { data, error } = await supabase!
      .from('tutor_flashcards')
      .insert(rows)
      .select('id');
    if (error || !data) {
      console.warn('[TutorReview] falha ao persistir flashcards:', error?.message);
      return [];
    }
    return data.map((r) => r.id as string);
  } catch (err) {
    console.warn('[TutorReview] falha ao persistir flashcards:', err);
    return [];
  }
}

/**
 * Gera um artefato de revisão (simulado, quiz, mapa mental, seminário,
 * resumo, plano ou flashcards) com LLM + fallback de providers.
 * Fonte primária: documentos enviados; fallback: conhecimento do modelo sobre o tema.
 * Persiste em review_artifacts (ou tutor_flashcards para flashcards).
 */
export async function generateReview(req: ReviewRequest): Promise<ReviewResult> {
  const tema = [req.tema, req.subtema].filter(Boolean).join(' — ') || 'agronomia';
  const { docSection, hasDocs } = await buildReviewContext(req);
  const prompt = buildPrompt(req, docSection);

  const { text } = await generateTextWithFallback({ prompt });
  const parsed = extractJson(text);

  const fonte: ReviewResult['fonte'] = hasDocs ? 'documento' : 'tema';

  switch (req.kind) {
    case 'simulado':
    case 'quiz': {
      const obj = (parsed ?? {}) as Record<string, unknown>;
      const questoes = normalizeQuestions(obj.questoes);
      if (questoes.length === 0) {
        throw new Error('A IA não gerou questões válidas. Tente novamente.');
      }
      const payload: SimuladoPayload = {
        titulo: String(obj.titulo ?? '').trim() || `Simulado — ${tema}`,
        tema,
        dificuldade: req.dificuldade ?? 'mista',
        fonte,
        questoes,
      };
      const artifactId = await persistArtifact(req, req.kind, payload, fonte);
      return { kind: req.kind, topic: tema, payload, artifactId, fonte };
    }

    case 'mapa_mental': {
      const payload = normalizeMapa(parsed);
      const artifactId = await persistArtifact(req, 'mapa_mental', payload, fonte);
      return { kind: 'mapa_mental', topic: tema, payload, artifactId, fonte };
    }

    case 'seminario': {
      const payload = normalizeSeminario(parsed, tema);
      const artifactId = await persistArtifact(req, 'seminario', payload, fonte);
      return { kind: 'seminario', topic: tema, payload, artifactId, fonte };
    }

    case 'resumo': {
      const payload = normalizeResumo(parsed, tema);
      const artifactId = await persistArtifact(req, 'resumo', payload, fonte);
      return { kind: 'resumo', topic: tema, payload, artifactId, fonte };
    }

    case 'plano': {
      const payload = normalizePlano(parsed, tema);
      const artifactId = await persistArtifact(req, 'plano', payload, fonte);
      return { kind: 'plano', topic: tema, payload, artifactId, fonte };
    }

    case 'flashcards': {
      const cards = normalizeFlashcards(parsed, tema);
      if (cards.length === 0) {
        throw new Error('A IA não gerou flashcards válidos. Tente novamente.');
      }
      const flashcardIds = await persistFlashcards(req, cards);
      return {
        kind: 'flashcards',
        topic: tema,
        payload: { cards },
        artifactId: null,
        flashcardIds,
        fonte,
      };
    }
  }
}

/** Lista artefatos de revisão salvos (mais recentes primeiro). */
export async function listReviewArtifacts(
  kind?: ReviewKind,
  userId?: string | null,
  limit = 10
): Promise<Array<{ id: string; kind: string; topic: string | null; payload: unknown; created_at: string }>> {
  if (!isSupabaseConfigured()) return [];
  try {
    let query = supabase!
      .from('review_artifacts')
      .select('id, kind, topic, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (kind && kind !== 'flashcards') query = query.eq('kind', kind);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as Array<{
      id: string;
      kind: string;
      topic: string | null;
      payload: unknown;
      created_at: string;
    }>;
  } catch {
    return [];
  }
}
