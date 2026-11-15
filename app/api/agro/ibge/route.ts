import { NextRequest, NextResponse } from 'next/server';
import {
  getIBGEMunicipalAgroData,
  IBGEProviderError,
  searchIBGEMunicipalities,
} from '@/lib/agroData/ibge';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const state = searchParams.get('state')?.trim() ?? undefined;
  if (search.length < 2 || search.length > 80) {
    return NextResponse.json({ municipalities: [] });
  }
  try {
    const municipalities = await searchIBGEMunicipalities(search, state);
    return NextResponse.json({ municipalities }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    if (error instanceof IBGEProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Não foi possível consultar os municípios do IBGE.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Informe o código IBGE do município.' }, { status: 400 });
  }
  const municipalityId = (raw as Record<string, unknown>).municipalityId;
  if (typeof municipalityId !== 'string' || !/^\d{7}$/.test(municipalityId)) {
    return NextResponse.json({ error: 'Código IBGE do município inválido.' }, { status: 400 });
  }
  try {
    const data = await getIBGEMunicipalAgroData(municipalityId);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof IBGEProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Não foi possível consultar os dados agropecuários do IBGE.' }, { status: 502 });
  }
}
