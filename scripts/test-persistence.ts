/**
 * E2E de integração da persistência semântica:
 *   Gemini (embedding 768) → indexSource (Supabase) → verificação → limpeza.
 *
 * Valida, na ordem da revisão de segurança (itens 9-11):
 *   1. Guard de dims no caminho real (embedText/embedTexts = 768);
 *   2. Escrita das 4 tabelas + search_queries via cliente privilegiado
 *      (`supabaseSemantic` — modo impresso no console);
 *   3. Leitura pública via publishable key (policy SELECT);
 *   4. Estado dos GRANTs de escrita de anon (diagnóstico: bloqueado?
 *      esperado "sim" após migration-semantic-privileged-writes.sql);
 *   5. Limpeza total (DELETE em sources cascateia chunks/categories/topics).
 *
 * Uso:
 *   npx --yes tsx scripts/test-persistence.ts
 *
 * Requer em .env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
 * e (pós-lockdown) SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY.
 *
 * Roda contra o banco configurado e SEMPRE limpa a fonte sintética ao
 * final (finally). Usa semanticStatus='full' para não disparar webhook
 * nem cadeia Inngest (só 'light' gatilha fase 2).
 */
import 'dotenv/config';
import type { UnderstoodSource } from '../lib/semantic/relevanceEngine';

const TOPIC = 'adubacao_nitrogenada';
const STAMP = Date.now();

async function main(): Promise<void> {
  // Imports dinâmicos após o dotenv (env precisa estar no module load de lib/supabase).
  const [{ indexSource, logSearchQuery }, { embedText }, supa, { EMBEDDING_DIM }] =
    await Promise.all([
      import('../lib/evidenceIndex'),
      import('../lib/semantic/embeddings'),
      import('../lib/supabase'),
      import('../lib/semantic/config'),
    ]);

  const failures: string[] = [];
  const check = (ok: boolean, label: string, detail?: string) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(label);
  };

  if (!supa.isSupabaseConfigured()) {
    console.error('✗ SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY ausentes em .env');
    process.exit(1);
  }

  const mode = supa.supabaseAdmin
    ? 'admin (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY)'
    : 'publishable (fallback — exige policies públicas de escrita)';
  console.log(`▸ Modo do cliente semântico: ${mode}`);
  if (!supa.supabaseAdmin) {
    console.log('  ⚠ Sem chave privilegiada: pós-migration as escritas vão falhar (por design).');
  }

  const db = supa.supabaseSemantic;
  if (!db) {
    console.error('✗ Cliente semântico indisponível');
    process.exit(1);
  }

  let sourceId: string | undefined;
  const logRow = `teste-persist-log-${STAMP}`;

  try {
    // ── 1. Embeddings reais (integração Gemini) ──────────────────────
    console.log('▸ Gerando embeddings (query + documento + chunk)...');
    const [qEmb, docEmb, chunkEmb] = await Promise.all([
      embedText('adubação nitrogenada em milho', 'RETRIEVAL_QUERY'),
      embedText(
        'A adubação nitrogenada em milho responde pelo manejo de dosagens na semeadura e em cobertura, com eficiência dependida de dose, época e fonte.',
        'RETRIEVAL_DOCUMENT',
      ),
      embedText(
        'Doses de 30 a 150 kg/ha de N em milho safrinha alteram a eficiência de uso do nitrogênio e a resposta de grãos.',
        'RETRIEVAL_DOCUMENT',
      ),
    ]);
    check(qEmb.length === EMBEDDING_DIM, `embed query = ${qEmb.length} dims`);
    check(docEmb.length === EMBEDDING_DIM, `embed documento = ${docEmb.length} dims`);
    check(chunkEmb.length === EMBEDDING_DIM, `embed chunk = ${chunkEmb.length} dims`);

    // ── 2. Fonte sintética → indexSource ─────────────────────────────
    const title = `[TESTE-PERSIST] Fonte sintética de integração ${STAMP}`;
    const source: UnderstoodSource = {
      id: `teste-persist-${STAMP}`,
      title,
      authors: 'AGRONÔMICA N-PRO (teste automatizado)',
      year: 2026,
      publication: 'scripts/test-persistence.ts',
      sourceName: 'Embrapa',
      sourceType: 'boletim_tecnico',
      abstract:
        'Fonte sintética criada pelo teste E2E para validar gravação em sources, source_chunks, source_categories e source_topics.',
      keywords: ['milho', 'nitrogênio', 'adubação nitrogenada'],
      searchUrl: 'https://example.invalid/teste-persistencia',
      abntCitation:
        'AGRONÔMICA N-PRO. Fonte sintética de integração. scripts/test-persistence.ts, 2026.',
      semanticScore: 88,
      semanticCategories: [{ label: 'adubação nitrogenada', score: 92 }],
      bestExcerpt: 'Doses de 30 a 150 kg/ha de N em milho safrinha...',
      discarded: false,
      docEmbedding: docEmb,
      chunks: [{ text: 'Doses de 30 a 150 kg/ha de N...', embedding: chunkEmb, score: 0.91 }],
      usedFullText: false,
      domainScore: 90,
      inAgroDomain: true,
      shouldPersist: true,
      semanticStatus: 'full',
      semanticQuery: 'adubação nitrogenada em milho',
    };

    console.log('▸ indexSource (fonte sintética)...');
    const indexed = await indexSource(source, [TOPIC]);
    check(indexed !== null, 'indexSource gravou', indexed ? `id=${indexed.id}` : 'retornou null (veja erro acima)');
    if (!indexed) throw new Error('abortando: sem fonte gravada não há o que verificar');
    sourceId = indexed.id;
    check(indexed.status === 'full', `status gravado = ${indexed.status}`);

    // ── 3. Verificação das 4 tabelas (cliente privilegiado) ──────────
    console.log('▸ Verificando escritas e dims no banco...');
    const { data: row } = await db
      .from('sources')
      .select('id, title, embedding, semantic_status, source_key')
      .eq('id', sourceId)
      .maybeSingle();
    check(!!row, 'sources: linha encontrada');
    check(
      Array.isArray(row?.embedding) && row.embedding.length === EMBEDDING_DIM,
      `sources.embedding = ${Array.isArray(row?.embedding) ? row.embedding.length : 'null'} dims`,
    );

    const { data: chunks } = await db
      .from('source_chunks')
      .select('chunk_index, embedding')
      .eq('source_id', sourceId);
    check(chunks?.length === 1, `source_chunks = ${chunks?.length ?? '?'} linha(s)`);
    check(
      Array.isArray(chunks?.[0]?.embedding) && chunks[0].embedding.length === EMBEDDING_DIM,
      `source_chunks.embedding = ${Array.isArray(chunks?.[0]?.embedding) ? chunks[0].embedding.length : '?'} dims`,
    );

    const { data: cats } = await db
      .from('source_categories')
      .select('label, score')
      .eq('source_id', sourceId);
    check(cats?.length === 1 && cats[0].label === 'adubação nitrogenada', `source_categories = ${cats?.length ?? '?'} linha(s)`);

    const { data: topics } = await db
      .from('source_topics')
      .select('topic_normalized, has_evidence')
      .eq('source_id', sourceId);
    check(
      !!topics?.some((t) => t.topic_normalized === TOPIC),
      `source_topics = ${topics?.length ?? '?'} linha(s) (esperado ${TOPIC})`,
    );

    // ── 4. Leitura pública via publishable key ───────────────────────
    const pub = supa.supabase;
    if (pub) {
      const { data: pubRow } = await pub
        .from('sources')
        .select('id')
        .eq('id', sourceId)
        .maybeSingle();
      check(!!pubRow, 'leitura pública (publishable) enxerga a fonte');
    }

    // ── 5. Diagnóstico: anon ainda consegue ESCREVER? ────────────────
    if (pub) {
      let anonWrite: 'ok' | 'bloqueada' | 'erro-desconhecido' = 'erro-desconhecido';
      try {
        const { data: upd, error } = await pub
          .from('sources')
          .update({ semantic_score: 88 })
          .eq('id', sourceId)
          .select('id');
        if (error) anonWrite = 'bloqueada';
        else anonWrite = upd && upd.length > 0 ? 'ok' : 'bloqueada';
      } catch {
        anonWrite = 'bloqueada';
      }
      const esperado = supa.supabaseAdmin ? 'bloqueada' : 'ok (pré-migration)';
      console.log(
        `  · escrita anon (publishable) = ${anonWrite} [esperado ${esperado}]` +
          (anonWrite === 'ok' && supa.supabaseAdmin
            ? ' ⚠ ABRIRAM — rode migration-semantic-privileged-writes.sql'
            : ''),
      );
    }

    // ── 6. logSearchQuery (só com chave privilegiada — select/back são privados)
    if (supa.supabaseAdmin) {
      await logSearchQuery(`[TESTE-PERSIST] consulta ${STAMP}`, [TOPIC], 1, 'new_search', 1);
      const { data: logged } = await db
        .from('search_queries')
        .select('id')
        .eq('query_text', `[TESTE-PERSIST] consulta ${STAMP}`)
        .maybeSingle();
      check(!!logged, 'search_queries: log gravado e legível via chave privilegiada');
      if (logged) {
        await db.from('search_queries').delete().eq('id', logged.id);
      }
    } else {
      console.log('  · logSearchQuery pulado (sem chave privilegiada: select privado indisponível)');
    }
  } finally {
    // ── 7. Limpeza total (cascata: chunks/categories/topics) ──────────
    if (sourceId && db) {
      const { error: delErr } = await db.from('sources').delete().eq('id', sourceId);
      const { data: left } = await db
        .from('sources')
        .select('id')
        .eq('id', sourceId)
        .maybeSingle();
      console.log(
        `▸ Limpeza: ${!delErr && !left ? 'fonte sintética removida (cascata ok)' : 'FALHOU — delete manual ' + sourceId}`,
      );
      if (delErr || left) failures.push('limpeza');
    }
  }

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} falha(s): ${failures.join(' | ')}`);
    process.exit(1);
  }
  console.log('\n✓ E2E de persistência semântica verde (modo: ' + mode + ')');
}

main().catch((err) => {
  console.error('\n✗ E2E abortou:', err);
  process.exit(1);
});
