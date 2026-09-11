import { LLMProviderConfig, LLMProviderResult, LLMStreamChunk } from './types';

const OPENROUTER_MODEL = 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function tryOpenRouter(
  config: LLMProviderConfig
): Promise<LLMProviderResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[LLM OpenRouter] OPENROUTER_API_KEY not configured');
    return null;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://localhost:3000',
      'X-Title': 'N-Pro Pesquisador',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: config.prompt,
        },
      ],
      stream: true,
      temperature: 0.7,
    }),
    signal: config.signal,
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn(
      `[LLM OpenRouter] Request failed: ${response.status} ${body.slice(0, 200)}`
    );
    return null;
  }

  const stream = new ReadableStream<LLMStreamChunk>({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          if (config.signal?.aborted) {
            reader.cancel();
            controller.close();
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              controller.enqueue({ text: '', done: true });
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue({ text: delta, done: false });
              }
            } catch {
              // skip malformed JSON lines
            }
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
    provider: 'openrouter',
    model: OPENROUTER_MODEL,
  };
}
