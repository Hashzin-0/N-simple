import { NextRequest } from 'next/server';
import { searchAllSources } from '@/lib/scrapers';
import { fetchUserDocuments, UserDocumentSource } from '@/lib/userDocuments';
import { buildPrompt, ArticleMode } from '@/lib/prompts';
import { generateWithFallback } from '@/lib/llm-providers';
import { decideReuse } from '@/lib/reuseDecision';
import { indexSources } from '@/lib/evidenceIndex';
import { extractTopics } from '@/lib/topicExtractor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { understandSources, filterAndRankRelevant, UnderstoodSource } from '@/lib/semantic/relevanceEngine';

export const dynamic = 'force-dynamic';

function formatSourceBlock(src: UnderstoodSource, idx: number): string {
  const lines = [
    `[Fonte ${idx}] CITAÇÃO ABNT: ${src.abntCitation}`,
    `Autores: ${src.authors}`,
    `Título: ${src.title}`,
    `Publicação: ${src.publication}`,
    `Ano: ${src.year}`,
    `Repositório: ${src.sourceName}`,
    `Tipo: ${src.sourceType}`,
    `URL Direta: ${src.directUrl || 'Não disponível'}`,
    `Resumo: ${src.abstract}`,
    `Palavras-chave: ${(src.keywords || []).join(', ')}`,
  ];
  if (src.vantagens?.length) lines.push(`Vantagens: ${src.vantagens.join('; ')}`);
  if (src.desvantagens?.length) lines.push(`Desvantagens: ${src.desvantagens.join('; ')}`);
  if (src.caracteristicas?.length) lines.push(`Características: ${src.caracteristicas.join('; ')}`);
  if (src.bestExcerpt) {
    lines.push(`Trecho mais relevante do texto completo: "${src.bestExcerpt}"`);
  }
  return lines.join('\n');
}

function formatSourcesByTopic(
  sources: UnderstoodSource[],
  topics: string[],
  originLabel?: string
): string {
  const header = originLabel ? `\n=== ${originLabel} ===` : '';

  if (topics.length === 0) {
    return header + '\n\n' + sources.slice(0, 30).map((src, idx) => formatSourceBlock(src, idx + 1)).join('\n\n');
  }

  const topicGroups: Record<string, UnderstoodSource[]> = {};
  for (const topic of topics) topicGroups[topic] = [];
  const ungrouped: UnderstoodSource[] = [];

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

  const lines: string[] = [header];
  let fontIdx = 1;

  for (const topic of topics) {
    const group = topicGroups[topic];
    if (group.length === 0) continue;
    lines.push(`\n--- TÓPICO: ${topic} ---`);
    for (const src of group.slice(0, 8)) {
      lines.push(formatSourceBlock(src, fontIdx));
      fontIdx++;
    }
  }

  if (ungrouped.length > 0) {
    lines.push('\n--- FONTES GERAIS (contexto amplo) ---');
    for (const src of ungrouped.slice(0, 10)) {
      lines.push(formatSourceBlock(src, fontIdx));
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
  sources: UnderstoodSource[];
  stats: { reused: number; newSearched: number; coverage: number; decision: string };
}

export async function POST(req: NextRequest) {
  let themeInput = '';
  let userLinks: string[] = [];
  let customTopics: string[] = [];
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
    let reuseStats: ReuseResult['stats'] | undefined;

    const allTopics = customTopics.length > 0 ? customTopics : extractTopics(themeInput);

    // ── CAMADA 1: Verificar memória de evidências ──
    const decision = isSupabaseConfigured()
      ? await decideReuse(themeInput, allTopics.length > 0 ? allTopics : undefined)
      : null;

    const canUseMemory = decision &&
      (decision.action === 'reuse' || decision.action === 'complementary') &&
      decision.sourcesToReuse.length > 0;

    if (canUseMemory) {
      // Reentende as fontes de memória com o tema atual (motor LLM-free real,
      // não apenas o overlap de tópico armazenado) e descarta as que não
      // se sustentam para este tema específico.
      const memoryUnderstood = filterAndRankRelevant(
        await understandSources(themeInput, decision.sourcesToReuse)
      );

      const topicsToSearch = decision.action === 'complementary'
        ? decision.topicsNeedingSearch
        : [];

      if (topicsToSearch.length > 0) {
        // ── CAMADA 2: Pesquisa de CONTRAPONTO (fontes novas vs. reutilizadas) ──
        const [newResult, userDocuments] = await Promise.all([
          searchAllSources(themeInput, topicsToSearch),
          fetchUserDocuments(userLinks, customTopics),
        ]);

        const newUnderstood = await understandSources(themeInput, newResult.sources);
        const newRelevant = filterAndRankRelevant(newUnderstood);

        reuseStats = {
          reused: memoryUnderstood.length,
          newSearched: newRelevant.length,
          coverage: decision.coverageScore,
          decision: decision.action,
        };

        const contrastNote =
          '\n\nATENÇÃO: as fontes abaixo vêm de duas origens — REUTILIZADAS (já ' +
          'validadas em pesquisas anteriores) e NOVAS (pesquisadas agora como ' +
          'contraponto). Cruze as informações: onde concordarem, reforce a ' +
          'afirmação citando ambas; onde divergirem, sinalize a divergência no ' +
          'texto em vez de ocultá-la.';

        sourcesContext =
          contrastNote +
          formatSourcesByTopic(memoryUnderstood, customTopics, 'FONTES REUTILIZADAS (memória)') +
          formatSourcesByTopic(newRelevant, customTopics, 'FONTES NOVAS (contraponto)');
        userDocsSection = formatUserDocsSection(userDocuments, customTopics);

        // Indexar fontes novas (relevantes E fora-de-tópico-mas-agro; resto descartado dentro)
        if (isSupabaseConfigured()) {
          indexSources(newUnderstood, allTopics).catch(err =>
            console.warn('[EvidenceIndex] Falha ao indexar complementares:', err)
          );
        }
      } else {
        // Reutilização total da memória (≥75%, sem necessidade de pesquisa nova)
        reuseStats = {
          reused: memoryUnderstood.length,
          newSearched: 0,
          coverage: decision.coverageScore,
          decision: decision.action,
        };
        const userDocuments = await fetchUserDocuments(userLinks, customTopics);
        sourcesContext = formatSourcesByTopic(memoryUnderstood, customTopics);
        userDocsSection = formatUserDocsSection(userDocuments, customTopics);
      }
    } else {
      // ── CAMADA 3: Pesquisa completa (sem memória aproveitável, <45%) ──
      const [searchResult, userDocuments] = await Promise.all([
        searchAllSources(themeInput, customTopics.length > 0 ? customTopics : undefined),
        fetchUserDocuments(userLinks, customTopics),
      ]);

      const understood = await understandSources(themeInput, searchResult.sources);
      const relevant = filterAndRankRelevant(understood);

      sourcesContext = formatSourcesByTopic(relevant, customTopics);
      userDocsSection = formatUserDocsSection(userDocuments, customTopics);
      reuseStats = {
        reused: 0,
        newSearched: relevant.length,
        coverage: decision?.coverageScore ?? 0,
        decision: 'new_search',
      };

      // Indexa tudo (relevantes + fora-de-tópico-mas-agro; resto descartado dentro).
      if (isSupabaseConfigured() && understood.length > 0) {
        indexSources(understood, allTopics).catch(err =>
          console.warn('[EvidenceIndex] Falha ao indexar novas:', err)
        );
      }
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
