import 'dotenv/config';
import { scrapeSciELO } from '../lib/scrapers/scielo';
import { scrapeEmbrapa } from '../lib/scrapers/embrapa';
import { scrapeBDTD } from '../lib/scrapers/bdtd';
import { scrapeCAPES } from '../lib/scrapers/capes';
import { scrapeGoogleScholar } from '../lib/scrapers/scholar';
import { scrapeYouTube } from '../lib/scrapers/youtube';
import { scrapeCNPEM } from '../lib/scrapers/cnpem';
import { scrapeINPA } from '../lib/scrapers/inpa';
import { scrapeIPEA } from '../lib/scrapers/ipea';
import { scrapeCrossref } from '../lib/scrapers/crossref';
import { scrapeOpenAlex } from '../lib/scrapers/openalex';
import { scrapeSemanticScholar } from '../lib/scrapers/semantic-scholar';
import { closeBrowser } from '../lib/stealthBrowser';

const QUERY = 'adubação nitrogenada milho';

const scrapers = [
  { name: 'Crossref', fn: scrapeCrossref, max: 50 },
  { name: 'OpenAlex', fn: scrapeOpenAlex, max: 50 },
  { name: 'Semantic Scholar', fn: scrapeSemanticScholar, max: 50 },
  { name: 'SciELO', fn: scrapeSciELO, max: 20 },
  { name: 'Embrapa', fn: scrapeEmbrapa, max: 20 },
  { name: 'BDTD', fn: scrapeBDTD, max: 20 },
  { name: 'CAPES', fn: scrapeCAPES, max: 25 },
  { name: 'Scholar', fn: scrapeGoogleScholar, max: 25 },
  { name: 'YouTube', fn: scrapeYouTube, max: 50 },
  { name: 'CNPEM', fn: scrapeCNPEM, max: 15 },
  { name: 'INPA', fn: scrapeINPA, max: 15 },
  { name: 'IPEA', fn: scrapeIPEA, max: 25 },
];

async function testScraper(s: typeof scrapers[0]) {
  const start = Date.now();
  try {
    const results = await s.fn(QUERY, s.max);
    const ms = Date.now() - start;
    if (results.length === 0) {
      return { name: s.name, ok: true, count: 0, ms, warning: 'returned 0 results' };
    }
    const sample = results.slice(0, 2).map(r => `  - ${r.title.slice(0, 80)}`).join('\n');
    const withImage = results.filter(r => r.imageUrl).length;
    return { name: s.name, ok: true, count: results.length, ms, sample, withImage };
  } catch (err) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return { name: s.name, ok: false, count: 0, ms, error: msg.slice(0, 200) };
  }
}

async function main() {
  console.log(`Testing scrapers with query: "${QUERY}"\n`);
  console.log('='.repeat(70));

  const results = await Promise.allSettled(scrapers.map(testScraper));

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const r of results) {
    const data = r.status === 'fulfilled' ? r.value : { name: 'unknown', ok: false, count: 0, ms: 0, error: String(r.reason) };
    const icon = data.ok && data.count > 0 ? '✓' : data.ok && data.count === 0 ? '⚠' : '✗';
    const imgInfo = 'withImage' in data && (data as any).withImage > 0 ? ` [${(data as any).withImage} with image]` : '';
    console.log(`\n${icon} ${data.name} — ${data.count} results (${data.ms}ms)${imgInfo}`);

    if (data.ok && data.count > 0 && 'sample' in data) {
      console.log(data.sample);
    }
    if (!data.ok && 'error' in data) {
      console.log(`  ERROR: ${data.error}`);
    }
    if ('warning' in data) {
      console.log(`  WARNING: ${data.warning}`);
    }

    if (data.ok && data.count > 0) passed++;
    else if (!data.ok) failed++;
    else warnings++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings} warnings (0 results)`);

  try { await closeBrowser(); } catch {}
}

main().catch(console.error);
