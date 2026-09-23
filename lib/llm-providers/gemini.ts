import { GoogleGenAI } from '@google/genai';
import { LLMProviderConfig, LLMProviderResult } from './types';

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

function getGeminiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS;
  if (keysEnv) {
    return keysEnv
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  const singleKey = process.env.GEMINI_API_KEY;
  return singleKey ? [singleKey] : [];
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('rate limit') ||
    msg.includes('403') ||
    msg.includes('PERMISSION_DENIED')
  );
}

function rejectIfAborted(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(signal.reason ?? new Error('Aborted')),
      { once: true }
    );
  });
}

export async function tryGemini(
  config: LLMProviderConfig
): Promise<LLMProviderResult | null> {
  const keys = getGeminiKeys();
  if (keys.length === 0) return null;
  if (config.signal?.aborted) return null;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const apiKey = keys[keyIndex];
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    for (const modelName of GEMINI_MODELS) {
      if (config.signal?.aborted) return null;
      try {
        const streamPromise = ai.models.generateContentStream({
          model: modelName,
          contents: config.prompt,
        });
        const response = config.signal
          ? await Promise.race([streamPromise, rejectIfAborted(config.signal)])
          : await streamPromise;

        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of response) {
                if (config.signal?.aborted) {
                  controller.close();
                  return;
                }
                const text = chunk.text || '';
                if (text) {
                  controller.enqueue({ text, done: false });
                }
              }
              controller.enqueue({ text: '', done: true });
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
          cancel() {},
        });

        return {
          stream,
          provider: 'gemini',
          model: modelName,
          keyIndex,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[LLM Gemini] Key ${keyIndex + 1}/${keys.length} Model ${modelName} failed:`,
          msg
        );
        if (isQuotaError(err)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return null;
}
