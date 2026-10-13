// Servidor local de teste: API real (lib/api.mjs) + PGlite + Blobs em memória + arquivos de public/
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export async function startServer({ port = 8899, password = 'teste123', dataDir } = {}) {
  process.env.HM_PASSWORD = password;
  globalThis.__HM_TEST_DB = dataDir ? new PGlite(dataDir) : new PGlite();
  globalThis.__HM_TEST_BLOBS = new Map();
  const { handle } = await import('../lib/api.mjs');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }));
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      let p = url.pathname === '/' ? '/index.html' : url.pathname;
      const root = p.startsWith('/site/') ? 'test' : 'public';
      const file = join(process.cwd(), root, p);
      let data = await readFile(file);
      if (root === 'test' && file.endsWith('.html')) data = data.toString().replaceAll('__KEY__', globalThis.__TEST_KEY || '');
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' });
      res.end(data);
    } catch (e) {
      res.writeHead(404); res.end('not found');
    }
  });
  await new Promise((r) => server.listen(port, r));
  return { server, url: `http://localhost:${port}`, db: globalThis.__HM_TEST_DB };
}

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  const s = await startServer({ dataDir: process.argv[2] });
  console.log('rodando em', s.url);
}
