import { NextRequest } from 'next/server';
import { buildStructure } from '@/lib/redacao/buildStructure';
import { generateRedacao } from '@/lib/redacao/generateRedacao';
import { validateRedacao } from '@/lib/redacao/validateRedacao';
import type {
  RedacaoResearchContext,
  RedacaoEstrutura,
  RedacaoMode,
} from '@/components/PesquisadorRedacao/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let tema = '';

  try {
    const body = await req.json();
    const context: RedacaoResearchContext = body.context;
    const modo: RedacaoMode = body.modo || 'automatico';
    const estruturaManual: RedacaoEstrutura | undefined = body.estrutura;
    const secoesEditadas = body.secoesEditadas;

    tema = context?.tema || '';

    if (!context || !tema) {
      return Response.json(
        { error: 'Contexto de pesquisa é obrigatório.' },
        { status: 400 }
      );
    }

    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
        };

        try {
          let estrutura: RedacaoEstrutura;

          if (modo === 'construir' && estruturaManual) {
            // Modo construir: usa a estrutura fornecida pelo usuário
            estrutura = estruturaManual;
            sendEvent('progress', { etapa: 'estrutura', mensagem: 'Usando estrutura definida pelo usuário.' });
          } else {
            // Modo automático: gera a estrutura primeiro
            sendEvent('progress', { etapa: 'estrutura', mensagem: 'Gerando estrutura da redação...' });

            const estruturaResult = await buildStructure(tema, context.repertorio);
            estrutura = estruturaResult.estrutura;

            sendEvent('structure_ready', { estrutura });
            sendEvent('progress', {
              etapa: 'estrutura_completa',
              mensagem: `Estrutura gerada: ${estrutura.desenvolvimentos.length} desenvolvimentos`,
            });
          }

          // ── Geração do texto ──
          sendEvent('progress', { etapa: 'redacao', mensagem: 'Redigindo o texto...' });

          const repertorioParaUsar = secoesEditadas
            ? context.repertorio // No modo construir, usa todo o repertório disponível
            : context.repertorio;

          const expressoesParaUsar = secoesEditadas
            ? context.expressoes
            : context.expressoes;

          const redacaoStream = await generateRedacao({
            tema,
            estrutura,
            repertorioSelecionado: repertorioParaUsar,
            expressoesSelecionadas: expressoesParaUsar,
            modo: modo === 'construir' ? 'construir' : 'automatico',
          });

          // Stream do texto da redação
          let fullText = '';
          const reader = redacaoStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (abortController.signal.aborted) break;
            fullText += value;
            sendEvent('chunk', { text: value, length: fullText.length });
          }

          sendEvent('redacao_pronta', { redacao: fullText });

          // ── Validação automática ──
          sendEvent('progress', { etapa: 'validacao', mensagem: 'Validando a redação...' });

          const validacao = await validateRedacao(
            fullText,
            tema,
            context.fontes,
            context.metadata.sourceSnapshot.split('|'),
          );

          sendEvent('validacao_pronta', { validacao });

          sendEvent('done', {
            redacao: fullText,
            estrutura,
            validacao,
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
    console.error('Error in redacao-gerar route:', err);
    const errorMessage = err instanceof Error ? err.message : 'Falha ao gerar redação.';
    return Response.json(
      { error: errorMessage, theme: tema },
      { status: 500 }
    );
  }
}
