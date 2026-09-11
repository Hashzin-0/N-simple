import { LLMProviderConfig, LLMProviderResult } from './types';
import { tryGemini } from './gemini';
import { tryOpenRouter } from './openrouter';

export async function generateWithFallback(
  config: LLMProviderConfig
): Promise<LLMProviderResult> {
  const geminiResult = await tryGemini(config);
  if (geminiResult) {
    console.log(
      `[LLM] Using Gemini model=${geminiResult.model} keyIndex=${geminiResult.keyIndex}`
    );
    return geminiResult;
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

export type { LLMProviderConfig, LLMProviderResult, LLMStreamChunk } from './types';
