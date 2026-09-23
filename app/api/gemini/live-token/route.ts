import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { LIVE_MODEL_ID, LIVE_VOICE_NAME } from '@/lib/liveConfig';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in server environment.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 1 * 60 * 1000).toISOString(),
      },
    });

    return NextResponse.json({
      token: token.name,
      model: LIVE_MODEL_ID,
      voice: LIVE_VOICE_NAME,
      wsBaseUrl:
        'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Falha ao criar token efêmero';
    console.error('Error creating ephemeral live token:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
