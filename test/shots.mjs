// Gera sessões simuladas e tira screenshots do painel
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';
const OUT = process.env.OUT || '/tmp/claude-0/shots';
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });

const { server, url } = await startServer({ port: 8898 });
const api = async (path, opts = {}, token) => (await fetch(url + '/api/' + path, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } })).json();
const { token } = await api('login', { method: 'POST', body: JSON.stringify({ password: 'teste123' }) });
const site = await api('sites', { method: 'POST', body: JSON.stringify({ name: 'Loja Teste', domains: 'localhost' }) }, token);
globalThis.__TEST_KEY = site.site_key;
await api('groups', { method: 'POST', body: JSON.stringify({ site_id: site.id, name: 'Produto', match_type: 'prefix', pattern: '/site/produto' }) }, token);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const UA_D = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const rnd = (a, b) => a + Math.random() * (b - a);
async function session(i) {
  const mobile = i % 4 === 3;
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, userAgent: mobile ? UA_M : UA_D });
  const p = await ctx.newPage();
  const q = ['', '?utm_source=instagram&utm_medium=social', '?utm_source=google&utm_medium=cpc', ''][i % 4];
  await p.goto(url + '/site/index.html' + q);
  await p.waitForTimeout(600);
  for (let k = 0; k < 6; k++) await p.mouse.move(rnd(100, 1300), rnd(80, 800), { steps: 6 });
  await p.mouse.move(rnd(640, 760), rnd(330, 360), { steps: 5 }); await p.waitForTimeout(rnd(300, 900));
  await p.mouse.wheel(0, rnd(200, 1800)); await p.waitForTimeout(500);
  if (i % 3 === 0) { const b = await p.locator('.banner h2').boundingBox(); if (b && b.y > 0 && b.y < 800) for (let r = 0; r < 4; r++) await p.mouse.click(b.x + rnd(10, 80), b.y + 10); }
  if (i % 2 === 0) { await p.locator('.buy').nth(i % 3).click().catch(() => {}); }
  await p.mouse.wheel(0, -3000); await p.waitForTimeout(2600);
  if (i % 5 !== 4) {
    await p.click('#cta'); await p.waitForLoadState(); await p.waitForTimeout(rnd(1500, 3500));
    await p.mouse.wheel(0, rnd(100, 900)); await p.waitForTimeout(300); await p.mouse.wheel(0, -2000);
    if (i % 2 === 1) { await p.click('#cta'); await p.waitForLoadState(); await p.fill('#email', 'x@y.com'); await p.waitForTimeout(2800); }
  }
  await p.close(); await ctx.close();
}
for (let i = 0; i < 12; i++) await session(i);
await new Promise((r) => setTimeout(r, 1000));
let fr; do { fr = await api('flush', {}, token); } while (fr.remaining > 0);
console.log('sessões geradas e processadas', fr);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
await page.goto(url + '/');
await page.fill('#pw', 'teste123'); await page.click('button[type=submit]');
await page.waitForSelector('.kpis', { timeout: 15000 });
await page.waitForTimeout(500);
const shot = async (hash, name, wait = 1500, sel) => {
  await page.goto(url + '/' + hash); if (sel) await page.waitForSelector(sel, { timeout: 20000 }).catch((e) => errs.push('timeout ' + sel));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
await shot('#/overview', '1-overview');
await shot('#/pages', '2-pages');
for (const m of ['click', 'zones', 'scroll', 'move', 'frust']) await shot(`#/heatmap?page=${encodeURIComponent('/site/index.html')}&mode=${m}`, '3-heatmap-' + m, 1500, '#st-hit');
await shot('#/journey', '4-journey', 1200, '.sankey');
await shot('#/funnel', '5-funnel', 1500, '.funnel');
await shot('#/sessions', '6-sessions', 1200, '.sess-row');
const sid = await page.$eval('.sess-row', (tr) => tr.dataset.id).catch(() => null);
if (sid) await shot('#/session/' + sid, '7-replay', 3500, '.rr-player');
await shot('#/settings', '8-settings', 1200);
await page.setViewportSize({ width: 390, height: 844 });
await shot('#/overview', '9-mobile-overview', 1000);
await shot(`#/heatmap?page=${encodeURIComponent('/site/index.html')}&mode=zones`, '9-mobile-heatmap', 1500, '#st-hit');
await shot('#/sessions', '9-mobile-sessions', 1200, '.sess-row');
await shot('#/journey', '9-mobile-journey', 1200, '.sankey');
await page.goto(url + '/#/overview'); await page.waitForTimeout(900); await page.click('#m-more'); await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/9-mobile-more.png` });
console.log(errs.join('\n') || 'sem erros no painel');
await browser.close(); server.close();
