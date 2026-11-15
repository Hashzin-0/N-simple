'use client';

import { useState, type FormEvent } from 'react';
import {
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Search,
  Sprout,
  Thermometer,
  Wind,
} from 'lucide-react';
import { requestWeatherForecast } from '@/lib/weather/client';
import type { WeatherForecast, WeatherRequest } from '@/lib/weather/types';

function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    .format(new Date(`${date}T12:00:00`));
}

function formatNumber(value: number | null, digits = 0): string {
  return value === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

export default function WeatherDashboard() {
  const [city, setCity] = useState('');
  const [days, setDays] = useState(7);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadForecast(params: WeatherRequest) {
    setLoading(true);
    setError(null);
    try {
      const result = await requestWeatherForecast({ ...params, days });
      setForecast(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar a previsão.');
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!city.trim()) {
      setError('Informe o nome de uma cidade.');
      return;
    }
    void loadForecast({ city: city.trim() });
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Este dispositivo não disponibiliza geolocalização. Informe uma cidade.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadForecast({ latitude: Math.round(position.coords.latitude * 100) / 100, longitude: Math.round(position.coords.longitude * 100) / 100 });
      },
      () => {
        setLoading(false);
        setError('A localização não foi autorizada ou não está disponível. Informe uma cidade para continuar.');
      },
      { timeout: 8000, maximumAge: 600_000 }
    );
  }

  return (
    <section id="weather_dashboard" className="mx-auto w-full max-w-7xl space-y-6" aria-labelledby="weather-dashboard-title">
      <div className="rounded-3xl border border-[#E2E0D6] bg-white p-6 shadow-sm dark:border-[#343D32] dark:bg-[#1C241D] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDF1E9] text-[#55764F] dark:bg-[#2B382B] dark:text-[#A9C49D]">
            <CloudSun className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#71836B]">Agroclima</p>
            <h2 id="weather-dashboard-title" className="mt-1 text-2xl font-bold text-[#344333] dark:text-[#E5EADF] sm:text-3xl">Tempo e planejamento da lavoura</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737B70] dark:text-[#B0B8AA]">Consulte temperatura, chuva, vento e evapotranspiração de referência para apoiar o planejamento das operações agrícolas.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto]">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-[#66705F] dark:text-[#C3CBBE]">Município ou localidade</span>
            <span className="flex items-center gap-2 rounded-xl border border-[#D9D6CB] bg-[#F8F9F5] px-3 dark:border-[#3C4739] dark:bg-[#151C16]">
              <MapPin className="size-4 shrink-0 text-[#71836B]" />
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Ribeirão Preto, SP" maxLength={120} className="h-11 w-full min-w-0 bg-transparent text-sm text-[#344333] outline-none placeholder:text-[#9AA294] dark:text-[#E5EADF]" />
            </span>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-[#66705F] dark:text-[#C3CBBE]">Previsão</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="h-11 w-full rounded-xl border border-[#D9D6CB] bg-[#F8F9F5] px-3 text-sm text-[#344333] outline-none dark:border-[#3C4739] dark:bg-[#151C16] dark:text-[#E5EADF]">
              <option value={1}>1 dia</option>
              <option value={3}>3 dias</option>
              <option value={5}>5 dias</option>
              <option value={7}>7 dias</option>
            </select>
          </label>
          <button type="submit" disabled={loading} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#55764F] px-4 text-sm font-bold text-white transition hover:bg-[#466442] disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar
          </button>
          <button type="button" onClick={handleCurrentLocation} disabled={loading} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D6CB] bg-white px-4 text-sm font-semibold text-[#55764F] transition hover:bg-[#F2F3ED] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3C4739] dark:bg-[#20271F] dark:text-[#A9C49D] dark:hover:bg-[#293329]">
            <MapPin className="size-4" /> Minha localização
          </button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      </div>

      {forecast ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#394638] dark:text-[#E5EADF]">{forecast.location}</h3>
              <p className="text-xs text-[#7B8176] dark:text-[#B0B8AA]">Atualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(forecast.fetchedAt))} · Fuso {forecast.timezone}</p>
            </div>
            {forecast.current && <div className="flex items-center gap-2 rounded-2xl border border-[#E2E0D6] bg-white px-4 py-3 dark:border-[#343D32] dark:bg-[#1C241D]"><Thermometer className="size-5 text-[#B47B65]" /><span className="text-2xl font-bold text-[#394638] dark:text-[#E5EADF]">{formatNumber(forecast.current.temperatureC)}°C</span><span className="text-xs text-[#7B8176] dark:text-[#B0B8AA]">{forecast.current.condition}</span></div>}
          </div>

          {forecast.current && <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E2E0D6] bg-white p-4 dark:border-[#343D32] dark:bg-[#1C241D]"><div className="flex items-center gap-2 text-xs font-semibold text-[#7B8176] dark:text-[#B0B8AA]"><Droplets className="size-4 text-[#4E8790]" /> Chuva atual</div><p className="mt-2 text-xl font-bold text-[#394638] dark:text-[#E5EADF]">{formatNumber(forecast.current.precipitationMm, 1)} mm</p></div>
            <div className="rounded-2xl border border-[#E2E0D6] bg-white p-4 dark:border-[#343D32] dark:bg-[#1C241D]"><div className="flex items-center gap-2 text-xs font-semibold text-[#7B8176] dark:text-[#B0B8AA]"><Wind className="size-4 text-[#6685B5]" /> Vento</div><p className="mt-2 text-xl font-bold text-[#394638] dark:text-[#E5EADF]">{formatNumber(forecast.current.windKmh)} km/h</p></div>
            <div className="rounded-2xl border border-[#E2E0D6] bg-white p-4 dark:border-[#343D32] dark:bg-[#1C241D]"><div className="flex items-center gap-2 text-xs font-semibold text-[#7B8176] dark:text-[#B0B8AA]"><Droplets className="size-4 text-[#4E8790]" /> Umidade relativa</div><p className="mt-2 text-xl font-bold text-[#394638] dark:text-[#E5EADF]">{formatNumber(forecast.current.relativeHumidityPct)}%</p></div>
          </div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {forecast.days.map((day) => <article key={day.date} className="rounded-2xl border border-[#E2E0D6] bg-white p-4 dark:border-[#343D32] dark:bg-[#1C241D]">
              <div className="flex items-center justify-between gap-2"><h4 className="font-bold capitalize text-[#394638] dark:text-[#E5EADF]">{formatDay(day.date)}</h4><CloudSun className="size-5 text-[#B47B65]" /></div>
              <p className="mt-1 text-xs text-[#7B8176] dark:text-[#B0B8AA]">{day.condition}</p>
              <div className="mt-3 flex items-baseline gap-3"><span className="text-xl font-bold text-[#394638] dark:text-[#E5EADF]">{formatNumber(day.temperatureMaxC)}°</span><span className="text-sm text-[#7B8176] dark:text-[#B0B8AA]">mín. {formatNumber(day.temperatureMinC)}°C</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#EEF0E9] pt-3 text-xs dark:border-[#343D32]">
                <div><span className="flex items-center gap-1 text-[#7B8176] dark:text-[#B0B8AA]"><Droplets className="size-3.5" /> Chuva</span><strong className="mt-1 block text-[#394638] dark:text-[#E5EADF]">{formatNumber(day.precipitationMm, 1)} mm</strong></div>
                <div><span className="flex items-center gap-1 text-[#7B8176] dark:text-[#B0B8AA]"><CloudSun className="size-3.5" /> Chance</span><strong className="mt-1 block text-[#394638] dark:text-[#E5EADF]">{formatNumber(day.precipitationProbabilityPct)}%</strong></div>
                <div><span className="flex items-center gap-1 text-[#7B8176] dark:text-[#B0B8AA]"><Sprout className="size-3.5" /> ET₀</span><strong className="mt-1 block text-[#394638] dark:text-[#E5EADF]">{formatNumber(day.referenceEvapotranspirationMm, 1)} mm</strong></div>
              </div>
            </article>)}
          </div>
          <p className="text-center text-[11px] text-[#7B8176] dark:text-[#B0B8AA]"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">{forecast.attribution}</a>. Previsões são estimativas e não substituem monitoramento local.</p>
        </div>
      ) : !loading && !error ? (
        <div className="rounded-2xl border border-dashed border-[#D9D6CB] bg-[#F8F9F5] px-5 py-10 text-center dark:border-[#3C4739] dark:bg-[#151C16]">
          <CloudSun className="mx-auto size-9 text-[#8B9A82]" />
          <h3 className="mt-3 font-bold text-[#394638] dark:text-[#E5EADF]">Nenhuma consulta realizada</h3>
          <p className="mt-1 text-sm text-[#7B8176] dark:text-[#B0B8AA]">Informe um município ou use sua localização para carregar a previsão.</p>
        </div>
      ) : null}
    </section>
  );
}
