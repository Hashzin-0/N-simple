import type { WeatherApiError, WeatherForecast, WeatherRequest } from './types';

export async function requestWeatherForecast(
  params: WeatherRequest,
  signal?: AbortSignal
): Promise<WeatherForecast> {
  const response = await fetch('/api/agro/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const payload = (await response.json()) as WeatherForecast | WeatherApiError;
  if (!response.ok || 'error' in payload) {
    const message = 'error' in payload ? payload.error : 'Não foi possível consultar a previsão.';
    throw new Error(message);
  }
  return payload;
}
