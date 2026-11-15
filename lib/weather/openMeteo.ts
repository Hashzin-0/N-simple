import type { WeatherDay, WeatherForecast, WeatherRequest } from './types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';
const DEFAULT_FORECAST_URL = 'https://api.open-meteo.com/v1';
const WMO_LABELS: Record<number, string> = {
  0: 'Céu limpo', 1: 'Predominantemente limpo', 2: 'Parcialmente nublado', 3: 'Encoberto',
  45: 'Nevoeiro', 48: 'Nevoeiro com geada', 51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa forte',
  56: 'Garoa congelante fraca', 57: 'Garoa congelante', 61: 'Chuva fraca', 63: 'Chuva',
  65: 'Chuva forte', 66: 'Chuva congelante fraca', 67: 'Chuva congelante forte', 71: 'Neve fraca',
  73: 'Neve', 75: 'Neve forte', 77: 'Grãos de neve', 80: 'Pancadas fracas', 81: 'Pancadas de chuva',
  82: 'Pancadas fortes', 85: 'Pancadas de neve fracas', 86: 'Pancadas de neve', 95: 'Trovoada',
  96: 'Trovoada com granizo', 99: 'Trovoada forte com granizo',
};

interface GeoPlace {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
  timezone?: string;
}

interface GeoResponse { results?: GeoPlace[] }
interface ForecastResponse {
  timezone?: string;
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    et0_fao_evapotranspiration?: (number | null)[];
  };
}

export class WeatherProviderError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'WeatherProviderError';
  }
}

function conditionFor(code?: number | null): string {
  if (typeof code !== 'number') return 'Condição não informada';
  return WMO_LABELS[code] ?? 'Condição não catalogada';
}

async function fetchProviderJson<T>(url: URL, revalidateSeconds: number): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: revalidateSeconds },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new WeatherProviderError('O serviço meteorológico excedeu o tempo limite.', 504, 'UPSTREAM_TIMEOUT');
    }
    throw new WeatherProviderError('O serviço meteorológico está indisponível no momento.', 502, 'UPSTREAM_UNAVAILABLE');
  }

  if (response.status === 429) {
    throw new WeatherProviderError('O limite de consultas meteorológicas foi atingido. Tente novamente mais tarde.', 429, 'RATE_LIMITED');
  }
  if (!response.ok) {
    throw new WeatherProviderError('O serviço meteorológico retornou uma resposta inválida.', 502, 'UPSTREAM_UNAVAILABLE');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new WeatherProviderError('Não foi possível interpretar a resposta meteorológica.', 502, 'UPSTREAM_UNAVAILABLE');
  }
}

function forecastEndpoint(): URL {
  const configured = process.env.OPEN_METEO_API_BASE_URL?.trim();
  const base = configured || DEFAULT_FORECAST_URL;
  try {
    const url = new URL(`${base.replace(/\/$/, '')}/forecast`);
    if (url.protocol !== 'https:') throw new Error('HTTPS obrigatório');
    return url;
  } catch {
    throw new WeatherProviderError('Configuração do provedor meteorológico inválida.', 500, 'UPSTREAM_UNAVAILABLE');
  }
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getWeatherForecast(input: WeatherRequest): Promise<WeatherForecast> {
  const days = Math.min(7, Math.max(1, Math.round(input.days ?? 5)));
  let latitude: number;
  let longitude: number;
  let locationName = 'Localização aproximada';

  if (input.city) {
    const city = input.city.trim();
    if (!city || city.length > 120) {
      throw new WeatherProviderError('Informe uma cidade válida (até 120 caracteres).', 400, 'INVALID_REQUEST');
    }
    const geocodeUrl = new URL(`${GEOCODING_URL}/search`);
    geocodeUrl.search = new URLSearchParams({ name: city, count: '1', language: 'pt', format: 'json' }).toString();
    const geo = await fetchProviderJson<GeoResponse>(geocodeUrl, 86_400);
    const place = geo.results?.[0];
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
      throw new WeatherProviderError(`Não encontrei a cidade "${city}". Confira o nome e tente novamente.`, 404, 'LOCATION_NOT_FOUND');
    }
    latitude = place.latitude;
    longitude = place.longitude;
    locationName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  } else {
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
      throw new WeatherProviderError('Informe uma cidade ou coordenadas válidas.', 400, 'INVALID_REQUEST');
    }
    if (input.latitude! < -90 || input.latitude! > 90 || input.longitude! < -180 || input.longitude! > 180) {
      throw new WeatherProviderError('As coordenadas informadas estão fora dos limites geográficos.', 400, 'INVALID_REQUEST');
    }
    latitude = input.latitude!;
    longitude = input.longitude!;

    const reverseUrl = new URL(`${GEOCODING_URL}/reverse`);
    reverseUrl.search = new URLSearchParams({
      latitude: String(roundCoordinate(latitude)),
      longitude: String(roundCoordinate(longitude)),
      language: 'pt',
      format: 'json',
    }).toString();
    try {
      const reverse = await fetchProviderJson<GeoResponse>(reverseUrl, 86_400);
      const place = reverse.results?.[0];
      if (place?.name) locationName = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
    } catch {
      // A previsão pode ser consultada mesmo quando a geocodificação reversa falha.
    }
  }

  // Arredondamento reduz a precisão da localização antes de enviá-la ao provedor.
  latitude = roundCoordinate(latitude);
  longitude = roundCoordinate(longitude);
  const forecastUrl = forecastEndpoint();
  forecastUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration',
    timezone: 'auto',
    forecast_days: String(days),
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    ...(process.env.OPEN_METEO_API_KEY ? { apikey: process.env.OPEN_METEO_API_KEY } : {}),
  }).toString();

  const forecast = await fetchProviderJson<ForecastResponse>(forecastUrl, 900);
  const daily = forecast.daily ?? {};
  const dates = daily.time ?? [];
  if (dates.length === 0) {
    throw new WeatherProviderError('A previsão não retornou dados para este local.', 502, 'UPSTREAM_UNAVAILABLE');
  }

  const resultDays: WeatherDay[] = dates.map((date, index) => ({
    date,
    weatherCode: daily.weather_code?.[index] ?? null,
    condition: conditionFor(daily.weather_code?.[index]),
    temperatureMaxC: daily.temperature_2m_max?.[index] ?? null,
    temperatureMinC: daily.temperature_2m_min?.[index] ?? null,
    precipitationProbabilityPct: daily.precipitation_probability_max?.[index] ?? null,
    precipitationMm: daily.precipitation_sum?.[index] ?? null,
    referenceEvapotranspirationMm: daily.et0_fao_evapotranspiration?.[index] ?? null,
  }));

  const current = forecast.current
    ? {
        temperatureC: forecast.current.temperature_2m ?? null,
        condition: conditionFor(forecast.current.weather_code),
        windKmh: forecast.current.wind_speed_10m ?? null,
        precipitationMm: forecast.current.precipitation ?? null,
        relativeHumidityPct: forecast.current.relative_humidity_2m ?? null,
      }
    : null;

  return {
    location: locationName,
    timezone: forecast.timezone ?? 'auto',
    current,
    days: resultDays,
    source: 'Open-Meteo',
    fetchedAt: new Date().toISOString(),
    attribution: 'Dados meteorológicos: Open-Meteo · CC BY 4.0',
  };
}
