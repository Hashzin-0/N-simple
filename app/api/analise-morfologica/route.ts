import { NextRequest } from 'next/server';
import { generateWithFallback } from '@/lib/llm-providers';
import { montarPromptIA, parsearFraseIA } from '@/lib/analiseMorfologica/ia';

export const dynamic = 'force-dynamic';

/**
 * Gera uma frase de análise morfológica com IA.
 * Responde { frase: { tokens } } ou { error } — o cliente cai
 * para a geração local quando a resposta não é 200.
 */
export async function POST(req: NextRequest) {
  try {
    const abortController = new AbortController();
    req.signal.addEventListener('abort', () => abortController.abort());

    const result = await generateWithFallback({
      prompt: montarPromptIA(),
      signal: abortController.signal,
    });

    let fullText = '';
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (abortController.signal.aborted) break;
      fullText += value.text;
    }

    const tokens = parsearFraseIA(fullText);
    if (!tokens) {
      return Response.json(
        { error: 'A IA não retornou uma frase válida.' },
        { status: 502 }
      );
    }

    return Response.json({ frase: { tokens } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Falha ao gerar frase com IA.';
    return Response.json({ error: message }, { status: 500 });
  }
}
