import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

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

    // Ephemeral tokens allow secure client-to-Gemini WebSocket connections in serverless/Vercel
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1alpha',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 50,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

    return NextResponse.json({
      token: token.name,
      model: 'models/gemini-3.1-flash-live-preview',
      voice: 'Puck',
      wsBaseUrl: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Falha ao criar token efêmero';
    console.error('Error creating ephemeral live token:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
