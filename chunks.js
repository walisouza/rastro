// Baixa e descompacta os pedaços de gravação (rrweb) guardados no Netlify Blobs
import { api } from './app.js';

const cache = new Map();
export async function loadChunk(key, enc) {
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const r = await api('chunk', { key }, { raw: true });
    let text;
    if (enc === 'gz') {
      if ('DecompressionStream' in window) {
        text = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
      } else throw new Error('Este navegador não descompacta gzip. Use Chrome, Edge, Firefox ou Safari atualizados.');
    } else text = await r.text();
    return JSON.parse(text);
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}
export async function loadEvents(chunks) {
  const parts = await Promise.all(chunks.map((c) => loadChunk(c.key, c.enc).catch(() => [])));
  const events = parts.flat().filter((e) => e && typeof e.timestamp === 'number');
  events.sort((a, b) => a.timestamp - b.timestamp);
  // o replay precisa começar num Meta (4) seguido de FullSnapshot (2)
  const first = events.findIndex((e) => e.type === 4);
  return first > 0 ? events.slice(first) : events;
}
