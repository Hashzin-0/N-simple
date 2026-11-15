import { NextRequest, NextResponse } from 'next/server';
import { getWeatherForecast, WeatherProviderError } from '@/lib/weather/openMeteo';
import type { WeatherRequest } from '@/lib/weather/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.', code: 'INVALID_REQUEST' }, { status: 400 });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Informe os parâmetros da consulta.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  if (body.city !== undefined && typeof body.city !== 'string') {
    return NextResponse.json({ error: 'O nome da cidade deve ser um texto.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined;
  const days = body.days === undefined ? 5 : body.days;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 7) {
    return NextResponse.json({ error: 'O período deve estar entre 1 e 7 dias.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (city && hasCoordinates) {
    return NextResponse.json({ error: 'Informe a cidade ou as coordenadas, não ambos.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (city.length > 120 || /[\u0000-\u001F\u007F]/.test(city)) {
    return NextResponse.json({ error: 'O nome da cidade é inválido ou excede o limite permitido.', code: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (hasCoordinates && (typeof body.latitude !== 'number' || typeof body.longitude !== 'number')) {
    return NextResponse.json({ error: 'Informe latitude e longitude numéricas.', code: 'INVALID_REQUEST' }, { status: 400 });
  }

  try {
    const input: WeatherRequest = {
      ...(city ? { city } : {}),
      ...(hasCoordinates ? { latitude: body.latitude as number, longitude: body.longitude as number } : {}),
      days,
    };
    const forecast = await getWeatherForecast(input);
    return NextResponse.json(forecast, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof WeatherProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Não foi possível consultar a previsão do tempo agora.', code: 'UPSTREAM_UNAVAILABLE' },
      { status: 502 }
    );
  }
}
