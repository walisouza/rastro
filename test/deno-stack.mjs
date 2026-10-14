// Sobe o ambiente "Supabase local": Postgres (PGlite via protocolo de rede) + Storage falso + Edge Function no Deno
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const db = new PGlite();
let sql = fs.readFileSync('supabase/migrations/20261014140000_rastro.sql', 'utf8')
  .replace(/^revoke .*$/m, '').replace(/^insert into storage\.buckets.*$/m, '');
await db.exec(sql);
const pg = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1' });
await pg.start();

const objects = new Map();
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const m = req.url.match(/^\/storage\/v1\/object\/([^/]+)\/?(.*)$/);
  if (!m) { res.writeHead(404); return res.end(); }
  const key = decodeURIComponent(m[2]);
  if (req.method === 'POST') { objects.set(key, body); res.writeHead(200); return res.end('{}'); }
  if (req.method === 'GET') { if (!objects.has(key)) { res.writeHead(400); return res.end('not found'); } res.writeHead(200); return res.end(objects.get(key)); }
  if (req.method === 'DELETE') { for (const k of JSON.parse(body).prefixes) objects.delete(k); res.writeHead(200); return res.end('[]'); }
  res.writeHead(405); res.end();
}).listen(8787);

const deno = spawn('/tmp/claude-0/node_modules/.bin/deno', ['run', '-A', '--quiet', 'supabase/functions/rastro/index.ts'], {
  env: { ...process.env, SUPABASE_DB_URL: 'postgres://postgres:postgres@127.0.0.1:5433/postgres', SUPABASE_URL: 'http://127.0.0.1:8787',
    SUPABASE_SERVICE_ROLE_KEY: 'test', RASTRO_PG_MAX: '1', HM_PASSWORD: 'teste123', HM_SECRET: 'segredo-teste', PORT: '8000' },
  stdio: 'inherit',
});
process.on('exit', () => deno.kill());
console.log('stack pronta: deno em http://localhost:8000');
