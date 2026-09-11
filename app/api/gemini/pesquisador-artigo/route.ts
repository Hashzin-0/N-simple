import { NextRequest } from 'next/server';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { searchAllSources } from '@/lib/scrapers';
import { fetchUserDocuments, UserDocumentSource } from '@/lib/userDocuments';
import { computeTrigonometricSimilarity } from '@/components/PesquisadorAgro/trigonometry';
import { buildPrompt, ArticleMode } from '@/lib/prompts';
import { generateWithFallback } from '@/lib/llm-providers';
import BM25 from 'okapibm25';

export const dynamic = 'force-dynamic';

function formatSourcesByTopic(
  sources: Awaited<ReturnType<typeof searchAllSources>>['sources'],
  topics: string[]
): string {
  if (topics.length === 0) {
    return sources
      .slice(0, 30)
      .map(
        (src, idx) =>
          `[Fonte ${idx + 1}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
URL de Busca: ${src.searchUrl}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}
Vantagens: ${(src.vantagens || []).join('; ') || 'Consultar artigo completo'}
Desvantagens: ${(src.desvantagens || []).join('; ') || 'Consultar artigo completo'}
Características: ${(src.caracteristicas || []).join('; ') || 'Consultar artigo completo'}`
      )
      .join('\n\n');
  }

  const topicGroups: Record<string, typeof sources> = {};
  for (const topic of topics) {
    topicGroups[topic] = [];
  }
  const ungrouped: typeof sources = [];

  for (const src of sources) {
    if (src.matchedTopics && src.matchedTopics.length > 0) {
      let placed = false;
      for (const t of src.matchedTopics) {
        if (topicGroups[t]) {
          topicGroups[t].push(src);
          placed = true;
        }
      }
      if (!placed) ungrouped.push(src);
    } else {
      ungrouped.push(src);
    }
  }

  const lines: string[] = [];
  let fontIdx = 1;

  for (const topic of topics) {
    const group = topicGroups[topic];
    if (group.length === 0) continue;

    lines.push(`\n--- TÓPICO: ${topic} ---`);
    for (const src of group.slice(0, 8)) {
      lines.push(
        `[Fonte ${fontIdx}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}`
      );
      fontIdx++;
    }
  }

  if (ungrouped.length > 0) {
    lines.push('\n--- FONTES GERAIS (contexto amplo) ---');
    for (const src of ungrouped.slice(0, 10)) {
      lines.push(
        `[Fonte ${fontIdx}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}`
      );
      fontIdx++;
    }
  }

  return lines.join('\n\n');
}

function formatUserDocsSection(
  documents: UserDocumentSource[],
  topics: string[]
): string {
  if (documents.length === 0) return '';

  const lines: string[] = [
    '\nDOCUMENTOS FORNECIDOS PELO USUÁRIO (PRIORIDADE MÁXIMA - use como fonte principal):',
  ];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    lines.push(`\n[Documento ${i + 1}]: ${doc.url}`);
    lines.push(`Título: "${doc.title}"`);
    lines.push(`Tipo: ${doc.contentType === 'pdf' ? 'PDF' : 'Página Web'}`);
    lines.push(`Citação ABNT: ${doc.abntCitation}`);

    if (doc.topicSections.length > 0) {
      lines.push('Trechos relevantes por tópico:');
      for (const section of doc.topicSections) {
        const truncated = section.relevantText.length > 800
          ? section.relevantText.slice(0, 800) + '...'
          : section.relevantText;
        lines.push(`  - Tópico "${section.topic}": ${truncated}`);
      }
    } else {
      const preview = doc.fullText.length > 500
        ? doc.fullText.slice(0, 500) + '...'
        : doc.fullText;
      lines.push(`Conteúdo extraído: ${preview}`);
    }
  }

  return lines.join('\n');
}

interface ReuseResult {
  sources: ScientificSource[];
  stats: { reused: number; newSearched: number };
}

const STOP_WORDS_SEARCH = new Set([
  'que', 'com', 'para', 'por', 'uma', 'dos', 'das', 'nas', 'nos', 'sobre',
  'como', 'pelo', 'pela', 'entre', 'mais', 'este', 'esta', 'esse', 'essa',
  'qual', 'quais', 'onde', 'quando', 'muito', 'cada', 'seus', 'suas', 'isso',
  'usando', 'utilizando', 'fazendo', 'tendo', 'sendo', 'podendo',
]);

function tokenizeForSearch(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS_SEARCH.has(t));
}

function buildSourceFullText(src: ScientificSource): string {
  return [
    src.title,
    src.abstract || '',
    (src.keywords || []).join(' '),
    (src.vantagens || []).join(' '),
    (src.desvantagens || []).join(' '),
    (src.caracteristicas || []).join(' '),
  ].join(' ');
}

function tokenFallbackMatch(topic: string, sourceText: string): boolean {
  const topicTokens = tokenizeForSearch(topic);
  if (topicTokens.length === 0) return false;

  const normalized = sourceText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  let matches = 0;
  for (const token of topicTokens) {
    if (normalized.includes(token)) matches++;
  }

  return (matches / topicTokens.length) >= 0.6;
}

async function reuseExistingSources(
  existing: ScientificSource[],
  query: string,
  topics: string[],
  minSourcesPerTopic: number
): Promise<ReuseResult> {
  const THRESHOLD = 0.45;

  // Step 1: Query-level trigonometry to filter broadly relevant sources
  const sourcesWithScore = existing.map(src => ({
    source: src,
    score: computeTrigonometricSimilarity(query, src)
  }));

  const validSources = sourcesWithScore.filter(item => (item.score?.cosTheta ?? 0) > THRESHOLD);

  // Step 2: Build text corpus for BM25 from valid sources
  const sourceTexts = validSources.map(item => buildSourceFullText(item.source));

  const reusedSources: ScientificSource[] = [];
  const missingTopics: string[] = [];
  let reusedCount = 0;

  if (topics.length > 0) {
    for (const topic of topics) {
      const topicTokens = tokenizeForSearch(topic);

      // BM25 scoring: rank all valid sources against this topic
      let bm25RawScores: number[] = [];
      if (topicTokens.length > 0 && sourceTexts.length > 0) {
        bm25RawScores = BM25(sourceTexts, topicTokens, { k1: 1.3, b: 0.75 }) as number[];
      }

      // Normalize BM25 to 0-1 range
      const maxBM25 = Math.max(...bm25RawScores, 0.001);
      const bm25Normalized = bm25RawScores.map(s => Math.min(1, s / maxBM25));

      // For each source, compute combined score: max(trig, bm25)
      const topicSources = validSources
        .map((item, idx) => {
          const trigScore = computeTrigonometricSimilarity(topic, item.source);
          const trigVal = trigScore?.cosTheta ?? 0;
          const bm25Val = bm25Normalized[idx] || 0;

          // Combined: use the better signal
          const combinedScore = Math.max(trigVal, bm25Val);

          // Token fallback: check if enough topic tokens appear in source
          const fullText = sourceTexts[idx];
          const fallback = tokenFallbackMatch(topic, fullText);

          return {
            item,
            combinedScore,
            trigVal,
            bm25Val,
            fallback,
          };
        })
        .filter(r => r.combinedScore > THRESHOLD || r.fallback);

      if (topicSources.length < minSourcesPerTopic) {
        missingTopics.push(topic);
      } else {
        const topSources = topicSources
          .sort((a, b) => b.combinedScore - a.combinedScore)
          .slice(0, 10)
          .map(r => ({
            ...r.item.source,
            matchedTopics: [topic],
          }));
        reusedSources.push(...topSources);
        reusedCount += topSources.length;
      }
    }
  } else {
    // No specific topics, use all valid sources sorted by query trigonometry
    const allValid = validSources
      .sort((a, b) => (b.score?.cosTheta ?? 0) - (a.score?.cosTheta ?? 0))
      .slice(0, 30)
      .map(item => item.source);
    reusedSources.push(...allValid);
    reusedCount = allValid.length;
  }

  // Search for new sources only for missing topics
  let newSearchedCount = 0;
  if (missingTopics.length > 0) {
    const newResult = await searchAllSources(query, missingTopics);
    reusedSources.push(...newResult.sources);
    newSearchedCount = newResult.sources.length;
  }

  return {
    sources: reusedSources,
    stats: { reused: reusedCount, newSearched: newSearchedCount }
  };
}

export async function POST(req: NextRequest) {
  let themeInput = '';
  let userLinks: string[] = [];
  let customTopics: string[] = [];
  let existingSources: ScientificSource[] = [];
  let minSourcesPerTopic = 3;
  let articleMode: ArticleMode = 'padrao';

  try {
    const body = await req.json();
    themeInput = (body?.theme || '').trim();
    if (Array.isArray(body?.userLinks)) {
      userLinks = body.userLinks
        .map((l: unknown) => (typeof l === 'string' ? l.trim() : ''))
        .filter((l: string) => l.length > 0);
    }
    if (Array.isArray(body?.customTopics)) {
      customTopics = body.customTopics
        .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t: string) => t.length > 0);
    }
    if (Array.isArray(body?.existingSources)) {
      existingSources = body.existingSources;
    }
    if (typeof body?.minSourcesPerTopic === 'number' && body.minSourcesPerTopic >= 1 && body.minSourcesPerTopic <= 10) {
      minSourcesPerTopic = body.minSourcesPerTopic;
    }
    if (body?.articleMode === 'aprofundado') {
      articleMode = 'aprofundado';
    }

    if (!themeInput) {
      return Response.json(
        { error: 'O parâmetro tema/título da pesquisa é obrigatório.' },
        { status: 400 }
      );
    }

    const hasAnyKey =
      process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!hasAnyKey) {
      return Response.json(
        {
          error: 'Nenhuma chave de API configurada. Configure GEMINI_API_KEYS ou OPENROUTER_API_KEY.',
          theme: themeInput,
        },
        { status: 503 }
      );
    }

    let sourcesContext: string;
    let userDocsSection: string;
    let reuseStats: { reused: number; newSearched: number } | undefined;

    const canReuseSources = existingSources.length > 0 && userLinks.length === 0;

    if (canReuseSources) {
      const reuseResult = await reuseExistingSources(
        existingSources,
        themeInput,
        customTopics,
        minSourcesPerTopic
      );
      reuseStats = reuseResult.stats;
      const userDocuments = await fetchUserDocuments(userLinks, customTopics);
      sourcesContext = formatSourcesByTopic(reuseResult.sources, customTopics);
      userDocsSection = formatUserDocsSection(userDocuments, customTopics);
    } else {
      const [searchResult, userDocuments] = await Promise.all([
        searchAllSources(themeInput, customTopics.length > 0 ? customTopics : undefined),
        fetchUserDocuments(userLinks, customTopics),
      ]);
      sourcesContext = formatSourcesByTopic(searchResult.sources, customTopics);
      userDocsSection = formatUserDocsSection(userDocuments, customTopics);
    }

    const customTopicsSection =
      customTopics.length > 0
        ? `TÓPICOS EXIGIDOS PELO USUÁRIO:
${customTopics.map((top, idx) => `3.${idx + 1} ${top}`).join('\n')}
`
        : `TÓPICOS PADRÃO:
3.1 Definição e Características Fundamentais
3.2 Vantagens Agronômicas, Produtivas e Econômicas
3.3 Desvantagens, Riscos Operacionais e Limitações Práticas
3.4 Análise Comparativa Direta (Práticas Tradicionais vs. Contemporâneas)`;

    const generatedAt = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const prompt = buildPrompt(articleMode, {
      theme: themeInput,
      sourcesContext: sourcesContext || 'Nenhuma fonte encontrada nos repositórios. Use conhecimento técnico agronômico consolidado.',
      userDocsSection,
      customTopicsSection,
      generatedAt,
    });

    const abortController = new AbortController();
    const signal = abortController.signal;

    req.signal.addEventListener('abort', () => abortController.abort());

    const llmResult = await generateWithFallback({ prompt, signal });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
          );
        };

        sendEvent('provider_info', {
          provider: llmResult.provider,
          model: llmResult.model,
        });

        let fullText = '';

        try {
          const streamReader = llmResult.stream.getReader();
          while (true) {
            const { done, value } = await streamReader.read();
            if (done) break;
            if (signal.aborted) break;
            fullText += value.text;
            sendEvent('chunk', { text: value.text, length: fullText.length });
          }

          sendEvent('done', {
            fullLength: fullText.length,
            reuseStats: reuseStats || null,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendEvent('error', { message: msg });
        } finally {
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('Error in pesquisador-artigo route:', err);
    const errorMessage =
      err instanceof Error ? err.message : 'Falha ao processar a geração do artigo científico.';
    return Response.json(
      { error: errorMessage, theme: themeInput || '' },
      { status: 500 }
    );
  }
}
