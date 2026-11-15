'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, LoaderCircle, MapPin, Search } from 'lucide-react';
import type { IBGEMunicipality, IBGEMunicipalAgroData } from '@/lib/agroData/ibge';

function numberBR(value: number | null, digits = 0): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

export default function IBGEAgroDashboard() {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<IBGEMunicipality[]>([]);
  const [selected, setSelected] = useState<IBGEMunicipality | null>(null);
  const [data, setData] = useState<IBGEMunicipalAgroData | null>(null);
  const [filter, setFilter] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2 || (selected && query === selected.label)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const response = await fetch(`/api/agro/ibge?search=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Não foi possível buscar municípios.');
        setSuggestions(Array.isArray(payload.municipalities) ? payload.municipalities : []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setError(err instanceof Error ? err.message : 'Não foi possível buscar municípios.');
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSearch(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, selected]);

  async function selectMunicipality(municipality: IBGEMunicipality) {
    setSelected(municipality);
    setSearch(municipality.label);
    setSuggestions([]);
    setData(null);
    setError(null);
    setLoadingData(true);
    try {
      const response = await fetch('/api/agro/ibge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipalityId: municipality.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar os dados do IBGE.');
      setData(payload as IBGEMunicipalAgroData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar os dados do IBGE.');
    } finally {
      setLoadingData(false);
    }
  }

  const crops = useMemo(() => {
    if (!data?.pamLatestYear) return [];
    const query = filter.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return data.pam
      .filter((row) => row.year === data.pamLatestYear && (!query || row.product.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query)))
      .sort((a, b) => (b.quantityTonnes ?? -1) - (a.quantityTonnes ?? -1))
      .slice(0, 12);
  }, [data, filter]);

  const herds = useMemo(() => {
    if (!data?.ppmLatestYear) return [];
    const query = filter.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return data.ppm
      .filter((row) => row.year === data.ppmLatestYear && (!query || row.animal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query)))
      .sort((a, b) => (b.heads ?? -1) - (a.heads ?? -1));
  }, [data, filter]);

  return (
    <section id="ibge_agro_dashboard" className="mx-auto w-full max-w-7xl space-y-6" aria-labelledby="ibge-agro-title">
      <div className="rounded-3xl border border-[#E2E0D6] bg-white p-6 shadow-sm dark:border-[#343D32] dark:bg-[#1C241D] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDF1E9] text-[#55764F] dark:bg-[#2B382B] dark:text-[#A9C49D]"><BarChart3 className="size-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#71836B]">Dados agropecuários oficiais</p>
            <h2 id="ibge-agro-title" className="mt-1 text-2xl font-bold text-[#344333] dark:text-[#E5EADF] sm:text-3xl">Produção por município</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737B70] dark:text-[#B0B8AA]">Consulte lavouras e efetivos pecuários a partir das séries anuais da PAM e da PPM do IBGE. Os dados são oficiais e identificados pelo ano de referência.</p>
          </div>
        </div>

        <div className="relative mt-6 max-w-2xl">
          <label htmlFor="ibge-municipality-search" className="mb-1.5 block text-xs font-semibold text-[#66705F] dark:text-[#C3CBBE]">Buscar município</label>
          <div className="flex items-center gap-2 rounded-xl border border-[#D9D6CB] bg-[#F8F9F5] px-3 dark:border-[#3C4739] dark:bg-[#151C16]">
            <MapPin className="size-4 shrink-0 text-[#71836B]" />
            <input id="ibge-municipality-search" value={search} onChange={(event) => { const value = event.target.value; setSearch(value); setSelected(null); setData(null); setError(null); if (value.trim().length < 2) { setSuggestions([]); setLoadingSearch(false); } }} placeholder="Digite ao menos duas letras — ex.: Ribeirão Preto" maxLength={80} autoComplete="off" className="h-11 w-full min-w-0 bg-transparent text-sm text-[#344333] outline-none placeholder:text-[#9AA294] dark:text-[#E5EADF]" />
            {loadingSearch ? <LoaderCircle className="size-4 animate-spin text-[#71836B]" /> : <Search className="size-4 text-[#71836B]" />}
          </div>
          {search.trim().length >= 2 && !(selected && search === selected.label) && suggestions.length > 0 && <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D9D6CB] bg-white p-1 shadow-xl dark:border-[#3C4739] dark:bg-[#20271F]">
            {suggestions.map((municipality) => <button key={municipality.id} type="button" onClick={() => void selectMunicipality(municipality)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-[#394638] transition hover:bg-[#EDF1E9] dark:text-[#E5EADF] dark:hover:bg-[#2B382B]">
              <span>{municipality.name}</span><span className="text-xs font-semibold text-[#7B8176] dark:text-[#B0B8AA]">{municipality.uf}</span>
            </button>)}
          </div>}
          {search.trim().length >= 2 && !loadingSearch && suggestions.length === 0 && !selected && <p className="mt-2 text-xs text-[#7B8176] dark:text-[#B0B8AA]">Nenhum município correspondente encontrado. Informe também a UF para refinar a busca.</p>}
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      </div>

      {loadingData && <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E2E0D6] bg-white px-5 py-10 text-sm text-[#66705F] dark:border-[#343D32] dark:bg-[#1C241D] dark:text-[#C3CBBE]"><LoaderCircle className="size-5 animate-spin" /> Consultando as séries oficiais do IBGE…</div>}

      {data && !loadingData && <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="text-lg font-bold text-[#394638] dark:text-[#E5EADF]">{data.municipality.label}</h3><p className="text-xs text-[#7B8176] dark:text-[#B0B8AA]">PAM: {data.pamLatestYear ?? 'sem período'} · PPM: {data.ppmLatestYear ?? 'sem período'} · Consulta {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.fetchedAt))}</p></div>
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar cultura ou rebanho" className="h-10 w-full max-w-xs rounded-xl border border-[#D9D6CB] bg-white px-3 text-sm text-[#344333] outline-none dark:border-[#3C4739] dark:bg-[#20271F] dark:text-[#E5EADF]" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-[#E2E0D6] bg-white dark:border-[#343D32] dark:bg-[#1C241D]">
            <div className="border-b border-[#EEF0E9] p-4 dark:border-[#343D32]"><h4 className="font-bold text-[#394638] dark:text-[#E5EADF]">Lavouras — PAM</h4><p className="mt-1 text-xs text-[#7B8176] dark:text-[#B0B8AA]">Área colhida, produção, rendimento e valor da produção (anual).</p></div>
            {crops.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#F5F7F1] text-[#66705F] dark:bg-[#20271F] dark:text-[#C3CBBE]"><tr><th className="px-3 py-3">Cultura</th><th className="px-3 py-3 text-right">Produção (t)</th><th className="px-3 py-3 text-right">Área (ha)</th><th className="px-3 py-3 text-right">Rendimento (kg/ha)</th><th className="px-3 py-3 text-right">Valor (mil R$)</th><th className="px-3 py-3 text-right">Média anual (R$/t)</th></tr></thead><tbody>{crops.map((row) => <tr key={`${row.year}-${row.product}`} className="border-t border-[#EEF0E9] text-[#394638] dark:border-[#343D32] dark:text-[#E5EADF]"><td className="px-3 py-3 font-semibold">{row.product}</td><td className="px-3 py-3 text-right tabular-nums">{numberBR(row.quantityTonnes, 1)}</td><td className="px-3 py-3 text-right tabular-nums">{numberBR(row.harvestedAreaHa, 1)}</td><td className="px-3 py-3 text-right tabular-nums">{numberBR(row.yieldKgHa, 1)}</td><td className="px-3 py-3 text-right tabular-nums">{numberBR(row.productionValueThousandBRL, 1)}</td><td className="px-3 py-3 text-right tabular-nums">{numberBR(row.annualUnitValueBRLPerTonne, 2)}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-[#7B8176] dark:text-[#B0B8AA]">Não há dados de lavouras para o filtro e o último período retornado.</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E2E0D6] bg-white dark:border-[#343D32] dark:bg-[#1C241D]">
            <div className="border-b border-[#EEF0E9] p-4 dark:border-[#343D32]"><h4 className="font-bold text-[#394638] dark:text-[#E5EADF]">Efetivo dos rebanhos — PPM</h4><p className="mt-1 text-xs text-[#7B8176] dark:text-[#B0B8AA]">Quantidade de animais por tipo de rebanho (cabeças).</p></div>
            {herds.length ? <div className="overflow-x-auto"><table className="w-full min-w-[340px] text-left text-xs"><thead className="bg-[#F5F7F1] text-[#66705F] dark:bg-[#20271F] dark:text-[#C3CBBE]"><tr><th className="px-4 py-3">Tipo de rebanho</th><th className="px-4 py-3 text-right">Cabeças</th></tr></thead><tbody>{herds.map((row) => <tr key={`${row.year}-${row.animal}`} className="border-t border-[#EEF0E9] text-[#394638] dark:border-[#343D32] dark:text-[#E5EADF]"><td className="px-4 py-3 font-semibold">{row.animal}</td><td className="px-4 py-3 text-right tabular-nums">{numberBR(row.heads)}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-[#7B8176] dark:text-[#B0B8AA]">Não há dados de rebanhos para o filtro e o último período retornado.</p>}
          </section>
        </div>

        <p className="text-xs text-[#7B8176] dark:text-[#B0B8AA]">Fonte: IBGE, SIDRA — tabelas <a href="https://sidra.ibge.gov.br/tabela/5457" target="_blank" rel="noreferrer" className="underline">5457 (PAM)</a> e <a href="https://sidra.ibge.gov.br/tabela/3939" target="_blank" rel="noreferrer" className="underline">3939 (PPM)</a>. Dados anuais. A média R$/t é derivada do valor da produção dividido pela quantidade; não representa cotação diária, preço spot ou indicador CEPEA.</p>
      </div>}

      {!data && !loadingData && <div className="rounded-2xl border border-dashed border-[#D9D6CB] bg-[#F8F9F5] px-5 py-8 text-center dark:border-[#3C4739] dark:bg-[#151C16]"><BarChart3 className="mx-auto size-8 text-[#8B9A82]" /><h3 className="mt-3 font-bold text-[#394638] dark:text-[#E5EADF]">Selecione um município</h3><p className="mt-1 text-sm text-[#7B8176] dark:text-[#B0B8AA]">Os resultados serão carregados diretamente das bases públicas do IBGE.</p></div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <a href="https://www.cepea.org.br/br/indicadores/" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E0D6] bg-white p-4 text-sm transition hover:border-[#9BAE8E] dark:border-[#343D32] dark:bg-[#1C241D]"><span><strong className="block text-[#394638] dark:text-[#E5EADF]">Indicadores CEPEA/ESALQ</strong><span className="mt-1 block text-xs text-[#7B8176] dark:text-[#B0B8AA]">Preços e séries de referência — API depende de contrato e credenciais.</span></span><ExternalLink className="size-4 shrink-0 text-[#71836B]" /></a>
        <a href="https://consultaprecosdemercado.conab.gov.br/" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E0D6] bg-white p-4 text-sm transition hover:border-[#9BAE8E] dark:border-[#343D32] dark:bg-[#1C241D]"><span><strong className="block text-[#394638] dark:text-[#E5EADF]">Preços de mercado — CONAB</strong><span className="mt-1 block text-xs text-[#7B8176] dark:text-[#B0B8AA]">Consulta oficial; uso sujeito às condições publicadas pela CONAB.</span></span><ExternalLink className="size-4 shrink-0 text-[#71836B]" /></a>
      </div>
    </section>
  );
}
