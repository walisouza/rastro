// Armazenamento em Netlify Blobs (memória nos testes):
//  - rastro-replay: gravações de sessão (rrweb, gzip)
//  - rastro-inbox:  lotes recebidos do script, aguardando ir para o banco
//  - rastro-meta:   configuração pública dos sites e marcações de tempo
const stores = new Map();

function store(name) {
  if (stores.has(name)) return stores.get(name);
  let s;
  if (globalThis.__HM_TEST_BLOBS) {
    const root = globalThis.__HM_TEST_BLOBS;
    if (!root.has(name)) root.set(name, new Map());
    const m = root.get(name);
    s = {
      set: async (k, v) => { m.set(k, typeof v === 'string' ? v : Buffer.from(v)); },
      get: async (k, type) => { if (!m.has(k)) return null; const v = m.get(k); return type === 'text' ? String(v) : Buffer.from(v); },
      delete: async (k) => { m.delete(k); },
      list: async (prefix = '') => [...m.keys()].filter((k) => k.startsWith(prefix)).sort(),
    };
  } else {
    let real = null;
    const get = async () => {
      if (!real) {
        const { getStore } = await import('@netlify/blobs');
        real = getStore({ name, consistency: name === 'rastro-replay' ? 'eventual' : 'strong' });
      }
      return real;
    };
    s = {
      set: async (k, v) => (await get()).set(k, typeof v === 'string' ? v : new Blob([v])),
      get: async (k, type) => {
        const st = await get();
        if (type === 'text') return st.get(k, { type: 'text' });
        const ab = await st.get(k, { type: 'arrayBuffer' });
        return ab ? Buffer.from(ab) : null;
      },
      delete: async (k) => (await get()).delete(k),
      list: async (prefix = '') => {
        const r = await (await get()).list(prefix ? { prefix } : {});
        return r.blobs.map((b) => b.key).sort();
      },
    };
  }
  stores.set(name, s);
  return s;
}

export const replay = () => store('rastro-replay');
export const inbox = () => store('rastro-inbox');
export const meta = () => store('rastro-meta');

export async function getJSON(st, key, dflt = null) {
  try { const t = await st.get(key, 'text'); return t ? JSON.parse(t) : dflt; } catch { return dflt; }
}
export async function putJSON(st, key, val) { return st.set(key, JSON.stringify(val)); }
