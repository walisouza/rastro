// Roda a cada 15 min: leva os lotes da fila (Blobs) para o banco em bloco.
// Com Netlify Database, só acorda o banco a cada HM_FLUSH_MINUTES (padrão 180) para economizar computação.
import { flush, cleanup } from '../../lib/api.mjs';
import { inbox, meta, getJSON, putJSON } from '../../lib/store.mjs';

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];

export default async () => {
  const external = !!env('DATABASE_URL');
  const every = Number(env('HM_FLUSH_MINUTES')) || (external ? 15 : 180);
  const pending = (await inbox().list()).length;
  if (!pending) return;
  const last = await getJSON(meta(), 'last_flush', null);
  const age = last ? Date.now() - new Date(last.at).getTime() : Infinity;
  if (age < every * 60e3 - 90e3 && pending < 4000) return;
  const r = await flush(22000);
  console.log('rastro flush', r);
  const lc = await getJSON(meta(), 'last_cleanup', null);
  if (!lc || Date.now() - new Date(lc.at).getTime() > 20 * 3600e3) {
    const c = await cleanup();
    await putJSON(meta(), 'last_cleanup', { at: new Date().toISOString(), ...c });
  }
};

export const config = { schedule: '*/15 * * * *' };
