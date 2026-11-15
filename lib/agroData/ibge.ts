export interface IBGEMunicipality {
  id: string;
  name: string;
  uf: string;
  label: string;
}

export interface IBGECropObservation {
  product: string;
  year: number;
  quantityTonnes: number | null;
  productionValueThousandBRL: number | null;
  harvestedAreaHa: number | null;
  yieldKgHa: number | null;
  annualUnitValueBRLPerTonne: number | null;
}

export interface IBGELivestockObservation {
  animal: string;
  year: number;
  heads: number | null;
}

export interface IBGEMunicipalAgroData {
  municipality: IBGEMunicipality;
  pam: IBGECropObservation[];
  ppm: IBGELivestockObservation[];
  pamLatestYear: number | null;
  ppmLatestYear: number | null;
  source: 'IBGE/SIDRA';
  fetchedAt: string;
}

type SidraRow = Record<string, string>;

interface IBGERawMunicipality {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } };
}

export class IBGEProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'IBGEProviderError';
  }
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

async function fetchJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: revalidateSeconds },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new IBGEProviderError('O IBGE excedeu o tempo de resposta. Tente novamente.', 504);
    }
    throw new IBGEProviderError('O serviço de dados do IBGE está indisponível.', 502);
  }
  if (response.status === 429) throw new IBGEProviderError('O limite de consultas do IBGE foi atingido. Tente novamente mais tarde.', 429);
  if (!response.ok) throw new IBGEProviderError(`O IBGE retornou HTTP ${response.status}.`, 502);
  try {
    return (await response.json()) as T;
  } catch {
    throw new IBGEProviderError('A resposta do IBGE não está em formato JSON válido.', 502);
  }
}

export async function searchIBGEMunicipalities(search: string, state?: string): Promise<IBGEMunicipality[]> {
  const query = normalizeSearch(search);
  if (query.length < 2) return [];
  const stateCode = state?.trim().toUpperCase();
  if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) throw new IBGEProviderError('UF inválida.', 400);

  const rows = await fetchJson<IBGERawMunicipality[]>(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
    86_400
  );
  return rows
    .map((row) => {
      const uf = row.microrregiao?.mesorregiao?.UF?.sigla
        ?? row['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
        ?? '';
      return { id: String(row.id), name: row.nome, uf, label: uf ? `${row.nome} - ${uf}` : row.nome };
    })
    .filter((row) => (!stateCode || row.uf === stateCode) && normalizeSearch(row.name).includes(query))
    .slice(0, 12);
}

function dimensionKeys(header: SidraRow, matcher: RegExp): { code: string; name: string } | null {
  for (let index = 1; index <= 9; index += 1) {
    const nameKey = `D${index}N`;
    const codeKey = `D${index}C`;
    if (matcher.test(header[nameKey] ?? '')) return { code: codeKey, name: nameKey };
  }
  return null;
}

function parseValue(raw: string | undefined): number | null {
  if (!raw || ['..', '...', '-', 'x', 'X'].includes(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parsePam(rows: SidraRow[]): IBGECropObservation[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const yearKeys = dimensionKeys(header, /^Ano$/i);
  const variableKeys = dimensionKeys(header, /^Variável$/i);
  const productKeys = dimensionKeys(header, /Produto das lavouras/i);
  if (!yearKeys || !variableKeys || !productKeys) {
    throw new IBGEProviderError('O layout da tabela PAM do IBGE mudou e precisa ser revisado.', 502);
  }

  const grouped = new Map<string, IBGECropObservation>();
  for (const row of rows.slice(1)) {
    const year = Number(row[yearKeys.code]);
    const product = row[productKeys.name];
    const variable = row[variableKeys.name] ?? '';
    const value = parseValue(row.V);
    if (!Number.isInteger(year) || !product || value === null) continue;
    const key = `${year}:${product}`;
    const entry = grouped.get(key) ?? {
      product,
      year,
      quantityTonnes: null,
      productionValueThousandBRL: null,
      harvestedAreaHa: null,
      yieldKgHa: null,
      annualUnitValueBRLPerTonne: null,
    };
    if (/Quantidade produzida/i.test(variable)) entry.quantityTonnes = value;
    else if (/Valor da produção/i.test(variable)) entry.productionValueThousandBRL = value;
    else if (/Área colhida/i.test(variable)) entry.harvestedAreaHa = value;
    else if (/Rendimento médio da produção/i.test(variable)) entry.yieldKgHa = value;
    grouped.set(key, entry);
  }
  for (const entry of grouped.values()) {
    if (entry.productionValueThousandBRL !== null && entry.quantityTonnes !== null && entry.quantityTonnes > 0 && entry.year >= 1994) {
      entry.annualUnitValueBRLPerTonne = (entry.productionValueThousandBRL * 1000) / entry.quantityTonnes;
    }
  }
  return [...grouped.values()].sort((a, b) => b.year - a.year || (b.quantityTonnes ?? -1) - (a.quantityTonnes ?? -1));
}

function parsePpm(rows: SidraRow[]): IBGELivestockObservation[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const yearKeys = dimensionKeys(header, /^Ano$/i);
  const animalKeys = dimensionKeys(header, /Tipo de rebanho/i);
  if (!yearKeys || !animalKeys) {
    throw new IBGEProviderError('O layout da tabela PPM do IBGE mudou e precisa ser revisado.', 502);
  }
  return rows.slice(1).flatMap((row) => {
    const year = Number(row[yearKeys.code]);
    const animal = row[animalKeys.name];
    const heads = parseValue(row.V);
    if (!Number.isInteger(year) || !animal || heads === null) return [];
    return [{ animal, year, heads }];
  }).sort((a, b) => b.year - a.year || a.animal.localeCompare(b.animal, 'pt-BR'));
}

async function fetchSidraTable(path: string): Promise<SidraRow[]> {
  const url = `https://apisidra.ibge.gov.br/values/${path}`;
  const rows = await fetchJson<unknown>(url, 86_400);
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object')) {
    throw new IBGEProviderError('O IBGE retornou uma estrutura de dados inesperada.', 502);
  }
  return rows as SidraRow[];
}

export async function getIBGEMunicipalAgroData(municipalityId: string): Promise<IBGEMunicipalAgroData> {
  if (!/^\d{7}$/.test(municipalityId)) throw new IBGEProviderError('Código IBGE do município inválido.', 400);

  const municipalityRow = await fetchJson<IBGERawMunicipality>(
    `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipalityId}`,
    86_400
  );
  if (!municipalityRow || String(municipalityRow.id) !== municipalityId) {
    throw new IBGEProviderError('Município não encontrado na base do IBGE.', 404);
  }
  // PAM 5457: quantidade (214), valor (215), área colhida (216) e rendimento (112), classificação 782.
  // PPM 3939: efetivo dos rebanhos (105), classificação 79. Ambas no nível municipal N6 e últimos cinco anos.
  const [pamRows, ppmRows] = await Promise.all([
    fetchSidraTable(`t/5457/n6/${municipalityId}/v/214,215,216,112/p/last%205/c782/0`),
    fetchSidraTable(`t/3939/n6/${municipalityId}/v/105/p/last%205/c79/0`),
  ]);
  const uf = municipalityRow.microrregiao?.mesorregiao?.UF?.sigla
    ?? municipalityRow['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
    ?? '';
  const municipality = {
    id: municipalityId,
    name: municipalityRow.nome,
    uf,
    label: uf ? `${municipalityRow.nome} - ${uf}` : municipalityRow.nome,
  };
  const pam = parsePam(pamRows);
  const ppm = parsePpm(ppmRows);
  return {
    municipality,
    pam,
    ppm,
    pamLatestYear: pam.length ? Math.max(...pam.map((row) => row.year)) : null,
    ppmLatestYear: ppm.length ? Math.max(...ppm.map((row) => row.year)) : null,
    source: 'IBGE/SIDRA',
    fetchedAt: new Date().toISOString(),
  };
}
