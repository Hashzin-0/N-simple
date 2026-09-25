export interface LLMStreamChunk {
  text: string;
  done: boolean;
  provider?: string;
  model?: string;
}

/** Parte multimodal extra (imagem em base64) enviada junto do prompt — Gemini only. */
export type LLMMultimodalPart = {
  inlineData: { mimeType: string; data: string };
};

export interface LLMProviderResult {
  stream: ReadableStream<LLMStreamChunk>;
  provider: string;
  model: string;
  keyIndex?: number;
}

export interface LLMProviderConfig {
  prompt: string;
  /** Parts multimodais extras (ex: imagens de páginas) — suportado apenas no Gemini. */
  parts?: LLMMultimodalPart[];
  signal?: AbortSignal;
}
