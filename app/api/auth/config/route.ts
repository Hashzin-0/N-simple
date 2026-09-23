import { NextResponse } from 'next/server';
import { getPublicAuthConfig } from '@/lib/authConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getPublicAuthConfig();
  if (!config.supabaseUrl || !config.supabaseKey) {
    return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 });
  }
  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
