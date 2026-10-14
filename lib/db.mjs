// Camada de banco (Postgres). Ordem de escolha:
//  1. DATABASE_URL            -> qualquer Postgres (ex.: Supabase, Neon próprio) via node-postgres
//  2. Netlify Database        -> @netlify/database (provisionado pelo Netlify)
//  3. NETLIFY_DATABASE_URL    -> extensão antiga "Netlify DB" (Neon)
//  0. Supabase Edge Function (Deno): SUPABASE_DB_URL / DATABASE_URL via postgres.js
//  Nos testes: PGlite.
import { SCHEMA, SCHEMA_VERSION } from './schema.mjs';

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? (globalThis.Deno?.env?.get?.(k)) ?? globalThis.process?.env?.[k];
// literal de array do Postgres (postgres.js no modo unsafe não converte arrays sozinho)
const pgArray = (a) => '{' + a.map((v) => (v == null ? 'NULL' : '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')).join(',') + '}';
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
  const sbUrl = env('SUPABASE_DB_URL');
  if (globalThis.Deno && (url || sbUrl)) {
    const postgres = globalThis.__RASTRO_POSTGRES || (await import('npm:postgres@3.4.5')).default;
    const sql = postgres(url || sbUrl, { max: Number(env('RASTRO_PG_MAX')) || 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
    backend = 'supabase';
    _query = async (text, params = []) => {
      // postgres.js serializa sozinho parâmetros jsonb: passa o objeto em vez do texto JSON
      const jsonIdx = new Set([...text.matchAll(/\$(\d+)::jsonb/g)].map((m) => +m[1] - 1));
      const ps = params.map((v, i) => (Array.isArray(v) ? pgArray(v) : jsonIdx.has(i) && typeof v === 'string' ? JSON.parse(v) : v));
      return [...(await sql.unsafe(text, ps))];
    };
    return _query;
  }
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
      if (backend === 'netlify-database' || backend === 'supabase') return;
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
