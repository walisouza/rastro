// Teste ponta a ponta: script de captura -> API -> banco -> relatórios
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const { server, url, db } = await startServer({ port: 8899, proxy: process.env.E2E_PROXY });
const api = async (path, opts = {}, token) => {
  const r = await fetch(url + '/api/' + path, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + t.slice(0, 300));
  return j;
};
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exitCode = 1; } else console.log('ok -', m); };

const { token } = await api('login', { method: 'POST', body: JSON.stringify({ password: 'teste123' }) });
ok(token, 'login');
let bad = false; try { await api('login', { method: 'POST', body: JSON.stringify({ password: 'x' }) }); } catch { bad = true; }
ok(bad, 'senha errada rejeitada');
const site = await api('sites', { method: 'POST', body: JSON.stringify({ name: 'Loja Teste', domains: 'localhost' }) }, token);
ok(site.site_key, 'site criado ' + site.site_key);
globalThis.__TEST_KEY = site.site_key;
await api('groups', { method: 'POST', body: JSON.stringify({ site_id: site.id, name: 'Produto', match_type: 'prefix', pattern: '/site/produto' }) }, token);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
async function visit(viewport, script) {
  const ctx = await browser.newContext({ viewport, userAgent: viewport.width < 600 ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' ' + (m.location().url||'')); });
  await page.goto(url + '/site/index.html');
  await page.waitForTimeout(800);
  await script(page);
  await page.close(); // dispara pagehide -> flush final
  await ctx.close();
}
const W = { width: 1440, height: 900 };
// sessão 1: home -> clica CTA -> produto -> adiciona -> checkout
await visit(W, async (p) => {
  await p.mouse.move(200, 200); await p.mouse.move(700, 400, { steps: 12 });
  await p.mouse.wheel(0, 700); await p.waitForTimeout(400);
  await p.click('.card:nth-child(2) .buy');
  await p.mouse.wheel(0, -700); await p.waitForTimeout(300);
  await p.waitForTimeout(2600);
  await p.click('#cta'); await p.waitForLoadState(); await p.waitForTimeout(3000);
  await p.click('#cta'); await p.waitForLoadState(); await p.waitForTimeout(1000);
  await p.fill('#email', 'pessoa@exemplo.com'); await p.waitForTimeout(2800);
});
// sessão 2: home -> rage clicks no banner -> sai
await visit(W, async (p) => {
  await p.mouse.wheel(0, 900); await p.waitForTimeout(500);
  const b = await p.locator('.banner h2').boundingBox();
  for (let i = 0; i < 4; i++) await p.mouse.click(b.x + 40, b.y + 10, { delay: 30 });
  await p.waitForTimeout(3200);
  await p.route('https://www.sympla.com.br/**', (r) => r.fulfill({ status: 200, body: 'ticketeria' }));
  await p.click('#ticket'); await p.waitForTimeout(1500);
});
// sessão 3: mobile, só home e bounce
await visit({ width: 390, height: 844 }, async (p) => {
  await p.click('#cta', { noWaitAfter: true }).catch(() => {});
  await p.waitForTimeout(3000);
});
await browser.close();
await new Promise((r) => setTimeout(r, 800));
ok(!errors.filter((e) => !/favicon/.test(e)).length, 'sem erros no console do site: ' + errors.join(' | '));

let st = await api('status', {}, token);
ok(process.env.E2E_PROXY ? st.pending === 0 : st.pending > 0, 'lotes na fila antes de processar: ' + st.pending);
let fr; do { fr = await api('flush', {}, token); } while (fr.remaining > 0);
ok(fr.failed === 0, 'fila processada sem falhas (' + fr.processed + ' lotes)');
st = await api('status', {}, token);
ok(st.pending === 0, 'fila vazia depois de processar');
const F = `site=${site.id}&from=${new Date(Date.now() - 864e5).toISOString()}&to=${new Date(Date.now() + 6e4).toISOString()}`;
const ov = await api('overview?' + F, {}, token);
ok(ov.kpis.sessions === 3, 'overview: 3 sessões (' + ov.kpis.sessions + ')');
ok(ov.kpis.pageviews >= 5, 'overview: pageviews ' + ov.kpis.pageviews);
ok(ov.kpis.rage > 0, 'overview: sessões com rage click ' + ov.kpis.rage);
ok(ov.kpis.dead > 0, 'overview: sessões com dead click ' + ov.kpis.dead);
ok(ov.kpis.conversions === 1, 'overview: 1 sessão converteu (clicou na ticketeria): ' + ov.kpis.conversions);
ok(Math.abs(ov.kpis.bounce - 0) < 1e-9, 'rejeição ignora quem clicou na ticketeria: ' + ov.kpis.bounce);
const pg = await api('pages?' + F + '&grouped=1', {}, token);
console.log(pg.rows.map((r) => `${r.label}: ${r.views} views, scroll ${Math.round(r.scroll)}%, saídas ${r.exits}`).join('\n'));
ok(pg.rows.some((r) => r.label === 'Produto'), 'agrupamento de páginas');
const hm = await api('heatmap?' + F + '&device=desktop&page=' + encodeURIComponent('/site/index.html'), {}, token);
ok(hm.clicks.length >= 2, 'heatmap: cliques ' + hm.clicks.length);
ok(hm.moves.length > 3, 'heatmap: movimento ' + hm.moves.length);
ok(hm.zones.length >= 2, 'heatmap: zonas ' + hm.zones.map((z) => z.txt).join(', '));
ok(hm.hovers.length >= 1, 'heatmap: hover ' + hm.hovers.length);
ok(hm.reach.length >= 2, 'heatmap: scroll reach ' + hm.reach.join(','));
ok(hm.snaps.length >= 1, 'heatmap: snapshot ' + hm.snaps.length);
ok(hm.frust.some((f) => f.type === 'rage'), 'heatmap: rage');
const snap = await api('snapshot?pv=' + hm.snaps[0].pv, {}, token);
ok(snap.chunks.length >= 1, 'snapshot chunks ' + snap.chunks.length);
const ss = await api('sessions?' + F, {}, token);
ok(ss.total === 3, 'lista de sessões');
const s1 = ss.rows.find((r) => r.pageviews === 3);
ok(s1 && s1.has_replay, 'sessão com 3 páginas e replay: ' + (s1 && s1.paths.join(' > ')));
const det = await api('session?id=' + s1.id, {}, token);
ok(det.chunks.length >= 3, 'chunks de replay da sessão ' + det.chunks.length);
const ch = await fetch(url + '/api/chunk?key=' + encodeURIComponent(det.chunks[0].key), { headers: { authorization: 'Bearer ' + token } });
const { gunzipSync } = await import('node:zlib');
const evs = JSON.parse(gunzipSync(Buffer.from(await ch.arrayBuffer())).toString());
ok(evs.some((e) => e.type === 2), 'chunk decodifica e tem snapshot completo (' + evs.length + ' eventos)');
const allText = JSON.stringify(evs);
const full = [];
for (const c of det.chunks) {
  const r = await fetch(url + '/api/chunk?key=' + encodeURIComponent(c.key), { headers: { authorization: 'Bearer ' + token } });
  full.push(gunzipSync(Buffer.from(await r.arrayBuffer())).toString());
}
ok(!full.join('').includes('pessoa@exemplo.com'), 'e-mail digitado está mascarado no replay');
const jr = await api('journey?' + F + '&grouped=1', {}, token);
ok(jr.rows.length >= 2, 'jornada: ' + jr.rows.map((r) => r.path.join(' > ') + ' (' + r.n + ')').join(' | '));
const fg = await api('funnel?' + F + '&grouped=1&steps=' + encodeURIComponent(JSON.stringify(['/site/index.html', '__goal__'])), {}, token);
ok(fg.counts.join(',') === '3,1', 'funil com etapa de conversão: ' + fg.counts.join(' → '));
ok(jr.rows.some((r) => r.conv), 'jornada marca sessão que converteu');
const sc = await api('sessions?' + F + '&converted=1', {}, token);
ok(sc.total === 1 && sc.rows[0].conv, 'filtro de sessões que converteram');
const pgc = await api('pages?' + F, {}, token);
ok(pgc.rows.find((r) => r.label === '/site/index.html').goal_pv === 1, 'conversão por página');
const fn = await api('funnel?' + F + '&grouped=1&steps=' + encodeURIComponent(JSON.stringify(['/site/index.html', 'Produto', '/site/checkout.html'])), {}, token);
ok(fn.counts.join(',') === '3,2,1', 'funil: ' + fn.counts.join(' → '));
let unauth = false; try { await api('overview?' + F); } catch (e) { unauth = /401/.test(e.message); }
ok(unauth, 'relatórios exigem login');
const wrongOrigin = await fetch(url + '/api/collect', { method: 'POST', headers: { origin: 'https://malicioso.com' }, body: JSON.stringify({ k: site.site_key, s: { id: '00000000-0000-4000-8000-000000000000' } }) });
ok(wrongOrigin.status === 403, 'domínio não autorizado bloqueado');
await api('cleanup', {}, token);
ok(true, 'limpeza roda');
server.close();
