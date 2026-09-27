/**
 * Cliente único do Semantic Scholar Graph API.
 *
 * Por que existe:
 * - A API anônima é um pool compartilhado: `/paper/search` (relevância) responde
 *   429 quase sempre a partir de IPs de nuvem (Vercel/dev container). O endpoint
 *   `/paper/search/bulk` tem um pool muito mais tolerante (~75% de sucesso) e é
 *   o recomendado pela própria documentação para recuperação em massa.
 * - Fan-out por tópico dispara várias chamadas em paralelo; aqui elas passam por
 *   uma fila com pacing mínimo entre requests e um circuit breaker para não
 *   segurar um slot de SCRAPER_CONCURRENCY pagando 429 repetido.
 *
 * Uso da chave (opcional): defina SEMANTIC_SCHOLAR_API_KEY para sair do pool
 * anônimo e ganhar 1 RPS garantido (header x-api-key).
 */

const S2_BASE = 'https://api.semanticscholar.org/graph/v1';

export class SemanticScholarError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SemanticScholarError';
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKey(): string | undefined {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  return key ? key : undefined;
}

/** 1 RPS garantido com chave; sem chave, mais conservador (pool compartilhado). */
function minIntervalMs(): number {
  return apiKey() ? 1100 : 1500;
}

// ---------------------------------------------------------------------------
// Pacing: serializa todas as chamadas S2 do processo com intervalo mínimo.
// ---------------------------------------------------------------------------
let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequestAt + minIntervalMs() - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Circuit breaker: 2 falhas 429 seguidas no canal que importa (bulk) → 30s de
// fail-fast. O 429 da relevância NÃO conta: em IP de nuvem ele é esperado
// toda vez e não indica que o bulk caiu.
// ---------------------------------------------------------------------------
const BREAKER_OPEN_MS = 30_000;
let consecutive429 = 0;
let breakerOpenUntil = 0;

function registerRateLimit(): void {
  consecutive429 += 1;
  if (consecutive429 >= 2) {
    breakerOpenUntil = Date.now() + BREAKER_OPEN_MS;
    consecutive429 = 0;
  }
}

function registerSuccess(): void {
  consecutive429 = 0;
  breakerOpenUntil = 0;
}

function breakerTripped(): boolean {
  return Date.now() < breakerOpenUntil;
}

// ---------------------------------------------------------------------------
// Query: remove operadores booleanos do S2 para não quebrar a sintaxe nem
// zerar resultados indevidamente (ex.: "-lixo", frases entre aspas).
// ---------------------------------------------------------------------------
export function sanitizeS2Query(query: string): string {
  return query
    .replace(/["'|+~*()[\]{}^]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function queryTokens(query: string): string[] {
  return [...new Set(sanitizeS2Query(query).split(' ').filter(Boolean))];
}

function bySelectivity(tokens: string[]): string[] {
  // Termos mais longos = mais seletivos (menos chance de estourar o teto de
  // 10M de hits do bulk, que responde 400 "too many hits").
  return [...tokens].sort((a, b) => b.length - a.length);
}

function pinnedSet(pinned: string[] | undefined): Set<string> {
  return new Set((pinned ?? []).map((t) => t.toLowerCase()));
}

/**
 * AND só com os termos mais seletivos — recuperação quando a query cheia dá 0.
 * Termos fixos (`pinnedTerms`, ex.: CNPEM) nunca são descartados.
 */
function narrowedAndQuery(query: string, pinned: string[] | undefined, take = 6): string {
  const pin = pinnedSet(pinned);
  const tokens = queryTokens(query);
  const kept = tokens.filter((t) => pin.has(t.toLowerCase()));
  const rest = bySelectivity(tokens.filter((t) => !pin.has(t.toLowerCase())));
  return [...kept, ...rest].slice(0, take).join(' ');
}

/**
 * OR de poucos termos longos (OR de muitos termos comuns passa de 10M → 400).
 * Com termos fixos, o OR fica entre parênteses e os fixos seguem em AND.
 */
function selectiveOrQuery(query: string, pinned: string[] | undefined, take = 4): string {
  const pin = pinnedSet(pinned);
  const tokens = queryTokens(query);
  const kept = tokens.filter((t) => pin.has(t.toLowerCase()));
  const rest = bySelectivity(tokens.filter((t) => !pin.has(t.toLowerCase())))
    .slice(0, take)
    .join(' | ');
  if (!rest) return '';
  return kept.length ? `(${rest}) ${kept.join(' ')}` : rest;
}

// ---------------------------------------------------------------------------
// HTTP com retry
// ---------------------------------------------------------------------------
interface RequestOptions {
  attempts: number;
  timeoutMs?: number;
  /** Se falso, 429 não alimenta o circuit breaker (usado na relevância). */
  countRateLimit?: boolean;
}

async function requestRaw(path: string, params: URLSearchParams, opts: RequestOptions): Promise<any> {
  const url = `${S2_BASE}${path}?${params.toString()}`;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = apiKey();
  if (key) headers['x-api-key'] = key;

  let lastError: SemanticScholarError = new SemanticScholarError('Semantic Scholar indisponível');

  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    if (breakerTripped()) {
      throw new SemanticScholarError('rate limit do Semantic Scholar (circuito aberto, tente em instantes)', 429);
    }

    let response: Response;
    try {
      response = await schedule(() => fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }));
    } catch (err) {
      lastError = new SemanticScholarError(
        `Semantic Scholar sem resposta: ${err instanceof Error ? err.message : String(err)}`
      );
      if (attempt < opts.attempts - 1) {
        await sleep(1000 + Math.random() * 1000);
        continue;
      }
      throw lastError;
    }

    if (response.ok) {
      registerSuccess();
      try {
        return await response.json();
      } catch (err) {
        throw new SemanticScholarError(
          `Semantic Scholar devolveu JSON inválido: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (response.status === 400) {
      const detail = await response.text().catch(() => '');
      throw new SemanticScholarError(`Semantic Scholar rejeitou a query (400): ${detail.slice(0, 160)}`, 400);
    }

    if (response.status === 429) {
      if (opts.countRateLimit !== false) registerRateLimit();
      lastError = new SemanticScholarError(
        'rate limit do Semantic Scholar (429) — pool anônima, tente em instantes',
        429
      );
    } else if (response.status >= 500) {
      lastError = new SemanticScholarError(`Semantic Scholar instável (HTTP ${response.status})`, response.status);
    } else {
      throw new SemanticScholarError(`Semantic Scholar rejeitou a requisição (HTTP ${response.status})`, response.status);
    }

    if (attempt < opts.attempts - 1) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const backoff = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0) ||
        1500 * Math.pow(2, attempt) + Math.random() * 1000;
      await sleep(Math.min(backoff, 8000));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export interface S2SearchOptions {
  maxResults: number;
  fields: string;
  /** Termos que precisam aparecer em TODOS os resultados (ex.: "CNPEM"). */
  pinnedTerms?: string[];
}

/**
 * Busca papers no Semantic Scholar:
 * 1. `/paper/search` (relevância) — 1 tentativa; quando dá 429 responde na
 *    hora, então tentar é barato e o ranking é o melhor.
 * 2. `/paper/search/bulk` com `sort=citationCount:desc` — pool anônimo muito
 *    mais tolerante.
 * 3. Se o bulk der 0 (a sintaxe exige TODOS os termos) ou 400 "too many hits",
 *    recupera com AND dos termos mais seletivos e, em último caso, OR de 4
 *    termos longos (OR amplo estoura o teto de 10M de hits do bulk).
 *
 * Devolve `[]` somente quando a API respondeu 200 sem resultados; joga
 * `SemanticScholarError` quando o canal de resgate também está bloqueado
 * (isso vira chip vermelho na UI em vez de um "(0)" mentiroso).
 */
export async function searchSemanticScholarPapers(
  query: string,
  options: S2SearchOptions
): Promise<any[]> {
  const cleanQuery = sanitizeS2Query(query);
  if (!cleanQuery) return [];

  const { maxResults, fields } = options;

  const bulkSearch = async (q: string, attempts: number): Promise<any[]> => {
    const params = new URLSearchParams({ query: q, fields, sort: 'citationCount:desc' });
    const data = await requestRaw('/paper/search/bulk', params, { attempts });
    const items = Array.isArray(data?.data) ? data.data : [];
    return items.slice(0, maxResults);
  };

  // 1) Relevância (1 tentativa, sem retry).
  try {
    const params = new URLSearchParams({
      query: cleanQuery,
      limit: String(Math.min(maxResults, 100)),
      fields,
    });
    const data = await requestRaw('/paper/search', params, {
      attempts: 1,
      timeoutMs: 8000,
      countRateLimit: false,
    });
    const items = Array.isArray(data?.data) ? data.data : [];
    if (items.length > 0) return items.slice(0, maxResults);
  } catch (err) {
    if (!(err instanceof SemanticScholarError)) throw err;
    // 429/timeout/5xx: segue para o bulk, que é o canal que funciona anônimo.
  }

  // 2) Bulk estrito (o canal de resgate).
  try {
    const items = await bulkSearch(cleanQuery, 3);
    if (items.length > 0) return items;
  } catch (err) {
    if (!(err instanceof SemanticScholarError)) throw err;
    if (err.status !== 400) {
      // 429/5xx/timeout no bulk = o canal de resgate também caiu → bloqueio real.
      throw err;
    }
    console.warn('[SemanticScholar] bulk rejeitou a query:', err.message);
  }

  // 3) Recuperação de recall. 429 em qualquer passo propaga (bloqueio real);
  //    400/timeout são engolidos com warn — o estrito já respondeu 0.
  const recover = async (q: string, attempts: number): Promise<any[]> => {
    try {
      return await bulkSearch(q, attempts);
    } catch (err) {
      if (err instanceof SemanticScholarError && err.status === 429) throw err;
      console.warn('[SemanticScholar] tentativa de resgate falhou:', err instanceof Error ? err.message : err);
      return [];
    }
  };

  const narrowed = narrowedAndQuery(cleanQuery, options.pinnedTerms);
  if (narrowed && narrowed !== cleanQuery) {
    const items = await recover(narrowed, 2);
    if (items.length > 0) return items;
  }

  const orQuery = selectiveOrQuery(cleanQuery, options.pinnedTerms);
  if (orQuery && orQuery !== cleanQuery && orQuery !== narrowed) {
    const items = await recover(orQuery, 2);
    if (items.length > 0) return items;
  }

  return [];
}
