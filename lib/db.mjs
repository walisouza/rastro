// Camada de banco (Postgres). Ordem de escolha:
//  1. DATABASE_URL            -> qualquer Postgres (ex.: Supabase, Neon próprio) via node-postgres
//  2. Netlify Database        -> @netlify/database (provisionado pelo Netlify)
//  3. NETLIFY_DATABASE_URL    -> extensão antiga "Netlify DB" (Neon)
//  Nos testes: PGlite.
import { SCHEMA, SCHEMA_VERSION } from './schema.mjs';

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
let _query = null;
let _ready = null;
export let backend = null;

async function getQuery() {
  if (_query) return _query;
  if (globalThis.__HM_TEST_DB) {
    const db = globalThis.__HM_TEST_DB;
    backend = 'pglite';
    _query = async (text, params = []) => (await db.query(text, params)).rows;
    return _query;
  }
  const url = env('DATABASE_URL');
  if (url) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: url, max: 3, idleTimeoutMillis: 10000,
      ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    });
    backend = 'postgres';
    _query = async (text, params = []) => (await pool.query(text, params)).rows;
    return _query;
  }
  try {
    const { getDatabase } = await import('@netlify/database');
    const db = getDatabase();
    backend = 'netlify-database';
    _query = async (text, params = []) => (await db.pool.query(text, params)).rows;
    return _query;
  } catch (e) {
    const legacy = env('NETLIFY_DATABASE_URL');
    if (legacy) {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(legacy);
      backend = 'netlify-db-legacy';
      _query = (text, params = []) => sql.query(text, params);
      return _query;
    }
    const err = new Error('Banco de dados não configurado. Crie um em Netlify > Data & Storage > Database, ou defina a variável DATABASE_URL com um Postgres (ex.: Supabase).');
    err.code = 'NO_DB';
    throw err;
  }
}

export async function q(text, params = []) {
  await ensureSchema();
  const query = await getQuery();
  return query(text, params);
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

export function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      const query = await getQuery();
      // No Netlify Database o schema é aplicado pelas migrações do deploy (netlify/database/migrations)
      if (backend === 'netlify-database') return;
      let current = 0;
      try {
        const r = await query(`select v from hm_meta where k = 'schema'`);
        current = r.length ? Number(r[0].v) : 0;
      } catch { current = 0; }
      if (current >= SCHEMA_VERSION) return;
      for (const stmt of SCHEMA) await query(stmt);
      await query(`insert into hm_meta (k, v) values ('schema', $1) on conflict (k) do update set v = excluded.v`, [String(SCHEMA_VERSION)]);
    })().catch((e) => { _ready = null; throw e; });
  }
  return _ready;
}
