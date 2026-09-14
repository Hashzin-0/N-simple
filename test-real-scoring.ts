import { scoreBySemanticRelevance } from './lib/scrapers/semanticFilter';
import { scrapeCrossref } from './lib/scrapers/crossref';
import { scrapeOpenAlex } from './lib/scrapers/openalex';

const queries = [
  'Gessagem e subsolo agricola',
  'Adubação nitrogenada para milho safrinha',
  'Manejo integrado de pragas na soja',
  'Cultivo de soja no cerrado',
];

async function runFilterTests() {
  for (const query of queries) {
    console.log('\n' + '='.repeat(80));
    console.log(`QUERY: "${query}"`);
    console.log('='.repeat(80));
    
    const crossrefResults = await scrapeCrossref(query, 5);
    const openalexResults = await scrapeOpenAlex(query, 5);
    const allResults = [...crossrefResults, ...openalexResults];
    
    console.log(`Raw: ${allResults.length}`);
    
    const filtered = await scoreBySemanticRelevance(query, allResults);
    
    console.log(`After filter: ${filtered.length}`);
    console.log(`Removed: ${allResults.length - filtered.length}`);
    
    filtered.forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.semanticLabel}] logit=${s.semanticLogit.toFixed(2)} | ${s.title.slice(0, 55)}`);
    });
  }
}

runFilterTests().catch(console.error);
