import { NextRequest } from 'next/server';
import { fetchUserDocuments } from '@/lib/userDocuments';
import { buildPrompt, ArticleMode } from '@/lib/prompts';
import { generateWithFallback } from '@/lib/llm-providers';
import { searchSources, formatSourcesByTopic, formatUserDocsSection } from '@/lib/research';

export const dynamic = 'force-dynamic';

interface ReuseResult {
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

    // ── Pesquisa unificada via orquestrador compartilhado ──
    const searchResult = await searchSources({
      query: themeInput,
      customTopics: customTopics.length > 0 ? customTopics : undefined,
    });

    const reuseStats: ReuseResult['stats'] = {
      reused: searchResult.reusedSources.length,
      newSearched: searchResult.newSources.length,
      coverage: searchResult.memoryDecision?.coverageScore ?? 0,
      decision: searchResult.memoryDecision?.action ?? 'new_search',
    };

    let sourcesContext: string;
    const isComplementary = searchResult.memoryDecision?.action === 'complementary'
      && searchResult.reusedSources.length > 0;

    if (isComplementary) {
      const contrastNote =
        '\n\nATENÇÃO: as fontes abaixo vêm de duas origens — REUTILIZADAS (já ' +
        'validadas em pesquisas anteriores) e NOVAS (pesquisadas agora como ' +
        'contraponto). Cruze as informações: onde concordarem, reforce a ' +
        'afirmação citando ambas; onde divergirem, sinalize a divergência no ' +
        'texto em vez de ocultá-la.';

      sourcesContext =
        contrastNote +
        formatSourcesByTopic(searchResult.reusedSources, customTopics, 'FONTES REUTILIZADAS (memória)') +
        formatSourcesByTopic(searchResult.newSources, customTopics, 'FONTES NOVAS (contraponto)');
    } else {
      sourcesContext = formatSourcesByTopic(searchResult.sources, customTopics);
    }

    // Documentos do usuário (prioridade máxima)
    const userDocuments = await fetchUserDocuments(userLinks, customTopics);
    const userDocsSection = formatUserDocsSection(userDocuments, customTopics);

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
