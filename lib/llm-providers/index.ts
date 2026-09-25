import { LLMProviderConfig, LLMProviderResult } from './types';
import { tryGemini } from './gemini';
import { tryOpenRouter } from './openrouter';

export async function generateWithFallback(
  config: LLMProviderConfig
): Promise<LLMProviderResult> {
  if (config.signal?.aborted) {
    throw config.signal.reason ?? new Error('Aborted');
  }
  const geminiResult = await tryGemini(config);
  if (geminiResult) {
    console.log(
      `[LLM] Using Gemini model=${geminiResult.model} keyIndex=${geminiResult.keyIndex}`
    );
    return geminiResult;
  }

  if (config.signal?.aborted) {
    throw config.signal.reason ?? new Error('Aborted');
  }
  console.warn('[LLM] All Gemini keys failed, falling back to OpenRouter');
  const openRouterResult = await tryOpenRouter(config);
  if (openRouterResult) {
    console.log(`[LLM] Using OpenRouter model=${openRouterResult.model}`);
    return openRouterResult;
  }

  throw new Error(
    'Todos os providers falharam. Verifique suas chaves de API (GEMINI_API_KEYS e OPENROUTER_API_KEY).'
  );
}

/** Consome um stream de LLM e devolve o texto completo. */
export async function collectText(
  stream: ReadableStream<{ text: string }>
): Promise<string> {
  const reader = stream.getReader();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += value.text;
  }
  return full;
}

/** Geração não-streaming (texto completo) com fallback de providers. */
export async function generateTextWithFallback(
  config: LLMProviderConfig
): Promise<{ text: string; provider: string; model: string }> {
  const result = await generateWithFallback(config);
  const text = await collectText(result.stream);
  return { text, provider: result.provider, model: result.model };
}

export type { LLMProviderConfig, LLMProviderResult, LLMStreamChunk } from './types';
