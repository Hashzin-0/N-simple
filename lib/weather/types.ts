export interface WeatherDay {
  date: string;
  weatherCode: number | null;
  condition: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number | null;
  referenceEvapotranspirationMm: number | null;
}

export interface WeatherCurrent {
  temperatureC: number | null;
  condition: string;
  windKmh: number | null;
  precipitationMm: number | null;
  relativeHumidityPct: number | null;
}

export interface WeatherForecast {
  location: string;
  timezone: string;
  current: WeatherCurrent | null;
  days: WeatherDay[];
  source: 'Open-Meteo';
  fetchedAt: string;
  attribution: string;
}

export interface WeatherRequest {
  city?: string;
  latitude?: number;
  longitude?: number;
  days?: number;
}

export interface WeatherApiError {
  error: string;
  code: 'INVALID_REQUEST' | 'LOCATION_NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNAVAILABLE';
}
