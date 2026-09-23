export const LIVE_MODEL_ID = 'models/gemini-3.8-live-extended-thinking';

export const LIVE_VOICE_NAME = 'Puck';

export type LiveThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export type LiveStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';
