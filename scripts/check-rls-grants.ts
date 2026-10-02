/**
 * Sonda os GRANTs/RLS atuais como o app os vê (publishable key).
 * UPDATE/INSERT em id inexistente: 42501 "permission denied for table"
 * = grant ausente; "row-level security" = grant ok, RLS bloqueando;
 * sucesso = permitido. Nenhuma linha real é modificada.
 */
import 'dotenv/config';

async function probe() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const H = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const NONE = '00000000-0000-0000-0000-000000000000';

  async function label(err: any): Promise<string> {
    const m = err?.message || '';
    if (m.includes('permission denied for table')) return 'SEM GRANT (permission denied)';
    if (m.includes('row-level security')) return 'GRANT ok, RLS bloqueia';
    if (m.includes('duplicate key')) return 'GRANT+RLS ok (chegou até o insert)';
    if (m.includes('null value') || m.includes('not-null')) return 'GRANT+RLS ok (chegou até constraint)';
    return m ? `erro: ${m}` : 'sucesso';
  }

  const tables = ['sources', 'source_chunks', 'source_categories', 'source_topics', 'search_queries'];
  for (const t of tables) {
    // UPDATE em id inexistente
    let upd: string;
    try {
      const r = await fetch(`${url}/rest/v1/${t}?id=eq.${NONE}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({}),
      });
      upd = r.ok ? 'UPDATE permitido (0 linhas)' : `UPDATE → ${await label(await r.json())}`;
    } catch (e: any) {
      upd = `UPDATE → ${await label(e)}`;
    }
    // INSERT vazio (nunca cria linha: NOT NULL)
    let ins: string;
    try {
      const r = await fetch(`${url}/rest/v1/${t}`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({}),
      });
      ins = r.ok ? 'INSERT permitido?!' : `INSERT → ${await label(await r.json())}`;
    } catch (e: any) {
      ins = `INSERT → ${await label(e)}`;
    }
    // SELECT
    let sel: string;
    try {
      const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, { headers: H });
      sel = r.ok ? 'SELECT ok' : `SELECT → ${await label(await r.json())}`;
    } catch (e: any) {
      sel = `SELECT → ${await label(e)}`;
    }
    console.log(`${t.padEnd(18)} | ${sel} | ${upd} | ${ins}`);
  }

  // RPC match_sources_by_embedding (precisa de vetor 768)
  try {
    const r = await fetch(`${url}/rest/v1/rpc/match_sources_by_embedding`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ query_embedding: new Array(768).fill(0), match_count: 1 }),
    });
    console.log(`RPC match_sources: ${r.ok ? 'ok' : await label(await r.json())}`);
  } catch (e: any) {
    console.log(`RPC match_sources: ${await label(e)}`);
  }
}

probe().catch((e) => console.error(e));
