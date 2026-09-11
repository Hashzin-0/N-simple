export interface LLMStreamChunk {
  text: string;
  done: boolean;
  provider?: string;
  model?: string;
}

export interface LLMProviderResult {
  stream: ReadableStream<LLMStreamChunk>;
  provider: string;
  model: string;
  keyIndex?: number;
}

export interface LLMProviderConfig {
  prompt: string;
  signal?: AbortSignal;
}
