// Rastro — painel
import { renderHeatmap } from './heatmap.js';
import { renderJourney, renderFunnel } from './journey.js';
import { renderReplay } from './replay.js';

// ================================================================ estado
const store = {
  get(k, d) { try { const v = localStorage.getItem('rastro_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rastro_' + k, JSON.stringify(v)); } catch {} },
};
export const S = {
  token: store.get('token', null),
  sites: [],
  siteId: store.get('site', null),
  range: store.get('range', '30d'),
  device: store.get('device', ''),
  grouped: store.get('grouped', true),
};
export const site = () => S.sites.find((s) => s.id === S.siteId) || null;

// ================================================================ util
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('pt-BR');
export const fmtInt = (n) => NF.format(Math.round(n || 0));
export const fmtPct = (x, d = 1) => (x == null || isNaN(x) ? '—' : (x * 100).toFixed(x * 100 >= 10 || d === 0 ? 0 : d).replace('.', ',') + '%');
export const fmtDur = (ms) => {
  if (ms == null || isNaN(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return m + 'min ' + String(r).padStart(2, '0') + 's';
  return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min';
};
export const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtDate = (d) => {
  const x = new Date(d), today = new Date();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const hm = x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (x.toDateString() === today.toDateString()) return 'Hoje, ' + hm;
  if (x.toDateString() === y.toDateString()) return 'Ontem, ' + hm;
  return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' + hm;
};
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}
const tipEl = () => document.getElementById('tip');
export function showTip(html, x, y) {
  const t = tipEl(); t.innerHTML = html; t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, top) + 'px';
}
export const hideTip = () => { tipEl().hidden = true; };

export const ICON = {
  overview: '<path d="M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z"/>',
  pages: '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>',
  heatmap: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  journey: '<path d="M3 6h5c4 0 4 12 8 12h5M3 18h5c2 0 3-3 4-6M16 6h5"/>',
  funnel: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/>',
  sessions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  mobile: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.2 3.2 0 0 1 0 6.3M21 20c0-2.6-1.6-4.9-4-5.7"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  exit: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  scroll: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v4"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7V4M9 4l1.5 2M15 4l-1.5 2M3 12h4M17 12h4M4 18l3-2M20 18l-3-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.4L3 9M4 13a8 8 0 0 0 14.7 4.4L21 15M3 4v5h5M21 20v-5h-5"/>',
};
export const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
export const devIcon = (d) => icon(d === 'mobile' ? 'mobile' : d === 'tablet' ? 'tablet' : 'desktop', 'dev-ico');
export const devName = (d) => ({ desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }[d] || d || '—');

// ================================================================ API
// RASTRO_API (definido em config.js) aponta para a Edge Function do Supabase; sem ele, usa /api do próprio site
export const API_BASE = (window.RASTRO_API || '/api').replace(/\/+$/, '');
// o t.js fica junto do painel; quando a API está em outro domínio, o snippet leva data-api
export const SCRIPT_URL = new URL('t.js', location.href).href;
export const SNIPPET_API = API_BASE.startsWith('http') ? API_BASE : '';
export async function api(path, params = {}, opts = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  const r = await fetch(API_BASE + '/' + path + (qs ? '?' + qs : ''), {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401 && path !== 'login') { logout(); throw new Error('Sessão expirada'); }
  if (opts.raw) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
  return j;
}

export function rangeDates(key = S.range) {
  const to = new Date();
  const from = new Date();
  if (key === 'today') from.setHours(0, 0, 0, 0);
  else if (key === 'yesterday') { from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0); to.setHours(0, 0, 0, 0); }
  else from.setTime(to.getTime() - (parseInt(key) || 30) * 864e5);
  return { from: from.toISOString(), to: new Date(to.getTime() + 60e3).toISOString() };
}
export const baseParams = (extra = {}) => ({
  site: S.siteId, ...rangeDates(), device: S.device, grouped: S.grouped ? 1 : '',
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...extra,
});

// ================================================================ auth
function logout() { S.token = null; store.set('token', null); renderLogin(); }

function renderLogin(msg = '') {
  document.getElementById('app').innerHTML = `
  <div class="login">
    <form id="lf">
      <div class="brand"><span class="brand-mark"></span><span>Rastro</span></div>
      <p>Mapas de calor, gravações de sessão e jornada dos visitantes dos seus sites.</p>
      <div class="field"><label for="pw">Senha</label><input class="inp" id="pw" type="password" autocomplete="current-password" required autofocus></div>
      ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
      <button class="btn primary" type="submit">Entrar</button>
    </form>
  </div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter; b.disabled = true;
    try {
      const { token } = await api('login', {}, { method: 'POST', body: { password: $('#pw').value } });
      S.token = token; store.set('token', token); boot();
    } catch (er) { renderLogin(er.message); }
  };
}

// ================================================================ shell
const NAV = [
  ['#', 'Relatórios'], ['overview', 'Visão geral'], ['pages', 'Páginas'],
  ['#', 'Comportamento'], ['heatmap', 'Mapa de calor'], ['journey', 'Jornada'], ['funnel', 'Funil'], ['sessions', 'Sessões'],
  ['#', 'Conta'], ['settings', 'Sites e instalação'],
];
const TABS = [['overview', 'Início'], ['heatmap', 'Calor'], ['journey', 'Jornada'], ['sessions', 'Sessões']];
const TITLES = { overview: 'Visão geral', kpi: 'Indicador', pages: 'Páginas', heatmap: 'Mapa de calor', journey: 'Jornada', funnel: 'Funil', sessions: 'Sessões', session: 'Sessão', settings: 'Sites' };
function renderShell() {
  document.getElementById('app').innerHTML = `
  <div class="shell">
    <aside class="rail">
      <a class="brand" href="#/overview"><span class="brand-mark"></span><span>Rastro</span></a>
      <nav class="nav">${NAV.map(([k, l]) => (k === '#' ? `<div class="lbl-sec">${l}</div>` : `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`)).join('')}</nav>
      <div class="rail-foot"><button id="theme">Tema</button><button id="out">Sair</button></div>
    </aside>
    <div class="main">
      <header class="appbar"><a class="brand" href="#/overview"><span class="brand-mark"></span><span>Rastro</span></a><span class="appbar-t" id="appbar-t"></span><button class="ico-btn" id="m-theme" aria-label="Alternar tema">${icon('sun')}</button></header>
      <div class="topbar" id="topbar"></div>
      <main class="content" id="view"></main>
    </div>
    <nav class="tabbar" aria-label="Navegação">${TABS.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`).join('')}<button id="m-more" data-k="more">${icon('more')}<span>Mais</span></button></nav>
    <div class="sheet-bg" id="sheet" hidden><div class="sheet" role="dialog" aria-label="Mais opções"><i class="grab"></i>
      ${[['pages', 'Páginas'], ['funnel', 'Funil'], ['settings', 'Sites e instalação']].map(([k, l]) => `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`).join('')}
      <button id="s-theme">${icon('sun')}<span>Alternar tema</span></button><button id="s-out">${icon('exit')}<span>Sair</span></button></div></div>
  </div>`;
  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', document.documentElement.dataset.theme);
  };
  const sheet = $('#sheet');
  $('#out').onclick = logout; $('#s-out').onclick = logout;
  $('#theme').onclick = toggleTheme; $('#m-theme').onclick = toggleTheme; $('#s-theme').onclick = () => { toggleTheme(); sheet.hidden = true; };
  $('#m-more').onclick = () => { sheet.hidden = false; };
  sheet.onclick = (e) => { if (e.target === sheet || e.target.closest('a')) sheet.hidden = true; };
}

function renderTopbar(view) {
  const tb = $('#topbar');
  if (!S.sites.length || view === 'settings') { tb.innerHTML = `<div class="grow"></div>`; return; }
  const ranges = [['today', 'Hoje'], ['yesterday', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias']];
  const hasGroups = (site()?.groups || 0) > 0;
  tb.innerHTML = `
    <select class="sel" id="f-site" aria-label="Site">${S.sites.map((s) => `<option value="${s.id}" ${s.id === S.siteId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <select class="sel" id="f-range" aria-label="Período">${ranges.map(([k, l]) => `<option value="${k}" ${k === S.range ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="seg" id="f-dev" role="group" aria-label="Dispositivo">${[['', 'Todos'], ['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']].map(([k, l]) => `<button data-v="${k}" class="${S.device === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="toggle" title="Usa os agrupamentos de páginas definidos em Sites e instalação" ${hasGroups ? '' : 'hidden'}><input type="checkbox" id="f-grp" ${S.grouped ? 'checked' : ''}> Agrupar páginas</label>
    <div class="grow"></div>
    <div id="sync">${syncHtml}</div>
    <button class="btn sm ghost" id="sync-b" title="Traz as visitas mais recentes para os relatórios">${icon('refresh')}<span>Atualizar dados</span></button>`;
  $('#sync-b').onclick = () => syncData(true);
  $('#f-site').onchange = (e) => { S.siteId = e.target.value; store.set('site', S.siteId); loadGroupsCount().then(route); };
  $('#f-range').onchange = (e) => { S.range = e.target.value; store.set('range', S.range); route(); };
  $$('#f-dev button').forEach((b) => (b.onclick = () => { S.device = b.dataset.v; store.set('device', S.device); route(); }));
  const g = $('#f-grp'); if (g) g.onchange = () => { S.grouped = g.checked; store.set('grouped', S.grouped); route(); };
}

// ================================================================ fila de dados (Blobs -> banco)
let syncing = false, syncHtml = '';
async function syncData(manual = false) {
  if (syncing) return;
  const show = (html) => { syncHtml = html; if ($('#sync')) $('#sync').innerHTML = html; };
  try {
    const st = await api('status');
    if (!st.pending) {
      show(st.last ? `<span class="muted small">Dados atualizados ${fmtDate(st.last.at).toLowerCase()}</span>` : '');
      if (manual) toast('Nenhum dado novo');
      return;
    }
    syncing = true;
    let total = 0, rem = st.pending;
    show(`<span class="small muted"><span class="spin" style="width:14px;height:14px;border-width:2px"></span> Processando ${fmtInt(rem)} lotes novos…</span>`);
    for (let i = 0; i < 60 && rem > 0; i++) {
      const r = await api('flush');
      total += r.processed; rem = r.remaining;
      show(`<span class="small muted"><span class="spin" style="width:14px;height:14px;border-width:2px"></span> Processando… faltam ${fmtInt(rem)} lotes</span>`);
      if (!r.processed && !r.failed) break;
    }
    syncing = false;
    show(`<span class="muted small">Dados atualizados agora</span>`);
    route();
  } catch (e) { syncing = false; show(`<span class="small" style="color:var(--bad)">${esc(e.message)}</span>`); }
}

async function loadGroupsCount() {
  const s = site(); if (!s) return;
  try { const { rows } = await api('groups', { site: s.id }); s.groups = rows.length; s.groupList = rows; } catch {}
}

// ================================================================ roteador
let routeToken = 0;
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { view: parts[0] || 'overview', arg: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(qs || '') };
}
export function go(hash) { location.hash = hash; }

async function route() {
  const my = ++routeToken;
  hideTip();
  const { view, arg, q } = parseHash();
  $$('.nav a, .tabbar a, .sheet a').forEach((a) => a.classList.toggle('on', a.dataset.k === view || (view === 'session' && a.dataset.k === 'sessions')));
  const more = $('#m-more'); if (more) more.classList.toggle('on', ['pages', 'funnel', 'settings'].includes(view));
  if ($('#appbar-t')) $('#appbar-t').textContent = TITLES[view] || '';
  renderTopbar(view);
  const el = $('#view');
  if (!S.sites.length && view !== 'settings') { go('#/settings'); return; }
  el.innerHTML = '<div class="loading"><span class="spin"></span></div>';
  const alive = () => my === routeToken;
  try {
    switch (view) {
      case 'overview': await renderOverview(el, alive); break;
      case 'kpi': await renderKpi(el, alive, arg); break;
      case 'pages': await renderPages(el, alive); break;
      case 'heatmap': await renderHeatmap(el, alive, q); break;
      case 'journey': await renderJourney(el, alive, q); break;
      case 'funnel': await renderFunnel(el, alive); break;
      case 'sessions': await renderSessions(el, alive, q); break;
      case 'session': await renderReplay(el, alive, arg); break;
      case 'settings': await renderSettings(el, alive, arg); break;
      default: go('#/overview');
    }
  } catch (e) {
    if (alive()) el.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    console.error(e);
  }
}
window.addEventListener('hashchange', route);

async function boot() {
  document.documentElement.dataset.theme = store.get('theme', null) || 'dark';
  if (!S.token) return renderLogin();
  renderShell();
  try {
    const { rows } = await api('sites');
    S.sites = rows;
    if (!site()) S.siteId = rows[0]?.id || null;
    store.set('site', S.siteId);
    await loadGroupsCount();
  } catch (e) { if (!S.token) return; }
  route();
  if (S.sites.length) syncData();
}
export async function reloadSites() {
  const { rows } = await api('sites');
  S.sites = rows;
  if (!site()) { S.siteId = rows[0]?.id || null; store.set('site', S.siteId); }
  await loadGroupsCount();
}

// ================================================================ componentes
export function delta(cur, prev, invert = false) {
  if (prev == null || cur == null || !isFinite(prev) || prev === 0) return '';
  const d = (cur - prev) / Math.abs(prev);
  if (Math.abs(d) < 0.005) return `<span class="delta flat">=</span>`;
  const good = invert ? d < 0 : d > 0;
  return `<span class="delta ${good ? 'up' : 'down'}" title="em relação ao período anterior">${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%</span>`;
}

export function barList(rows, { key = 'k', val = 'n', fmt = fmtInt, extra = null, total = null, onClick = null } = {}) {
  if (!rows?.length) return '<div class="muted small">Sem dados no período.</div>';
  const max = Math.max(...rows.map((r) => r[val]));
  const tot = total ?? rows.reduce((a, r) => a + r[val], 0);
  return `<div class="list">${rows.map((r, i) => `
    <div class="li" ${onClick ? `data-i="${i}" style="cursor:pointer"` : ''} title="${esc(r[key])}">
      <i class="b" style="width:calc(${(r[val] / max) * 100}% + 6px)"></i>
      <span class="k">${esc(r[key])}</span>
      <span class="v">${fmt(r[val])} <span class="muted small">${tot ? fmtPct(r[val] / tot, 0) : ''}</span>${extra ? ' ' + extra(r) : ''}</span>
    </div>`).join('')}</div>`;
}

function lineChart(series, bucket) {
  if (!series.length) return '<div class="muted small" style="height:220px;display:grid;place-items:center">Sem sessões no período.</div>';
  const W = 900, H = 220, P = { l: 40, r: 10, t: 10, b: 26 };
  const max = Math.max(1, ...series.map((s) => s.sessions));
  const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); const n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const top = nice(max);
  const x = (i) => P.l + (series.length === 1 ? (W - P.l - P.r) / 2 : (i / (series.length - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - v / top) * (H - P.t - P.b);
  const pts = series.map((s, i) => [x(i), y(s.sessions)]);
  const fr = series.map((s, i) => [x(i), y(s.frustrated)]);
  const cv = series.map((s, i) => [x(i), y(s.converted || 0)]);
  const path = (p) => p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('');
  const ticks = [0, top / 2, top];
  const lab = (b) => { const d = new Date(b); return bucket === 'hour' ? d.getHours() + 'h' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
  const every = Math.max(1, Math.ceil(series.length / 8));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-chart>
    ${ticks.map((t) => `<line class="grid-l" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmtInt(t)}</text>`).join('')}
    ${series.map((s, i) => (i % every === 0 ? `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${lab(s.b)}</text>` : '')).join('')}
    <path class="area" d="${path(pts)}L${x(series.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>
    <path class="ln" d="${path(pts)}" vector-effect="non-scaling-stroke"/>
    <path class="ln3" d="${path(cv)}" vector-effect="non-scaling-stroke"/>
    <path class="ln2" d="${path(fr)}" vector-effect="non-scaling-stroke"/>
    <line class="hov" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" visibility="hidden" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
// versão celular: colunas arredondadas, agrupadas em até 8 barras
function barChart(series, bucket) {
  if (!series.length) return '';
  const n = Math.min(8, series.length), per = Math.ceil(series.length / n);
  const bins = [];
  for (let i = 0; i < series.length; i += per) {
    const g = series.slice(i, i + per);
    bins.push({ b: g[0].b, e: g[g.length - 1].b, sessions: g.reduce((a, s) => a + s.sessions, 0), converted: g.reduce((a, s) => a + (s.converted || 0), 0) });
  }
  const max = Math.max(1, ...bins.map((x) => x.sessions));
  const peak = bins.reduce((m, x, i) => (x.sessions > bins[m].sessions ? i : m), 0);
  const lab = (x) => { const d = new Date(x.b); return bucket === 'hour' ? d.getHours() + 'h' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
  return `<div class="mbars" data-mbars>${bins.map((x, i) => `<button class="mbar ${i === peak ? 'on' : ''}" data-i="${i}" aria-label="${lab(x)}: ${fmtInt(x.sessions)} sessões">
    <span class="mbar-v">${fmtInt(x.sessions)}</span>
    <span class="mbar-t"><i style="height:${Math.max(4, (x.sessions / max) * 100)}%"></i>${x.converted ? `<b style="height:${(x.converted / max) * 100}%"></b>` : ''}</span>
    <span class="mbar-l">${lab(x)}</span></button>`).join('')}</div>`;
}
function bindBars(el) {
  $$('[data-mbars] .mbar', el).forEach((b) => (b.onclick = () => { $$('.mbar', b.parentNode).forEach((x) => x.classList.toggle('on', x === b)); }));
}
function bindChart(el, series, bucket) {
  const svg = $('[data-chart]', el); if (!svg) return;
  const hov = $('.hov', svg);
  svg.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width * 900;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(((fx - 40) / (900 - 50)) * (series.length - 1))));
    const s = series[i]; if (!s) return;
    const xx = 40 + (series.length === 1 ? 425 : (i / (series.length - 1)) * 850);
    hov.setAttribute('x1', xx); hov.setAttribute('x2', xx); hov.setAttribute('visibility', 'visible');
    const d = new Date(s.b);
    const when = bucket === 'hour' ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    showTip(`<b>${when}</b><div class="tr"><span>Sessões</span><span>${fmtInt(s.sessions)}</span></div><div class="tr"><span>Pageviews</span><span>${fmtInt(s.pageviews)}</span></div><div class="tr"><span>Converteram</span><span>${fmtInt(s.converted || 0)}</span></div><div class="tr"><span>Com frustração</span><span>${fmtInt(s.frustrated)}</span></div>`, e.clientX, e.clientY);
  });
  svg.addEventListener('mouseleave', () => { hov.setAttribute('visibility', 'hidden'); hideTip(); });
}

const KPI_ICO = ['sessions', 'users', 'eye', 'target', 'clock', 'exit', 'scroll', 'pulse', 'zap', 'bug'];
const KPI_KEYS = ['sessions', 'visitors', 'pageviews', 'conversion', 'avg_duration', 'bounce', 'scroll', 'activity', 'rage', 'errors'];

// ================================================================ visão geral
async function renderOverview(el, alive) {
  const d = await api('overview', baseParams());
  if (!alive()) return;
  const k = d.kpis, p = d.prev || {};
  const frustr = Math.max(k.rage || 0, k.dead || 0);
  const K = [
    ['Sessões', fmtInt(k.sessions), delta(k.sessions, p.sessions)],
    ['Visitantes', fmtInt(k.visitors), delta(k.visitors, p.visitors)],
    ['Pageviews', fmtInt(k.pageviews), delta(k.pageviews, p.pageviews)],
    [esc(site().goal_label || 'Conversão'), fmtPct(k.conversion), delta(k.conversion, p.conversion), (site().goal ? 'Sessões que clicaram em link com: ' + site().goal : 'Sessões que clicaram em algum link para fora do site') + '. Essas sessões não contam como rejeição.'],
    ['Duração média', fmtDur(k.avg_duration), delta(k.avg_duration, p.avg_duration)],
    ['Taxa de rejeição', fmtPct(k.bounce), delta(k.bounce, p.bounce, true), 'Sessões de uma página só que não clicaram no link de conversão'],
    ['Scroll médio', k.scroll == null ? '—' : Math.round(k.scroll) + '%', delta(k.scroll, p.scroll)],
    ['Taxa de atividade', fmtPct(k.activity, 0), delta(k.activity, p.activity), 'Parte do tempo na página em que o visitante interagiu (mouse, toque, scroll, teclado)'],
    ['Sessões com rage click', fmtPct(k.rage), delta(k.rage, p.rage, true), '3 ou mais cliques rápidos no mesmo ponto', k.rage > 0.05],
    ['Sessões com erro JS', fmtPct(k.errors), delta(k.errors, p.errors, true), null, k.errors > 0.05],
  ];
  el.innerHTML = `
    <div class="page-head"><div><h1>Visão geral</h1><p>${esc(site().name)}: como as pessoas chegam, quanto ficam e onde travam.</p></div>
      <a class="btn" href="#/sessions?frustration=1">${icon('sessions')} Ver sessões com frustração</a></div>
    ${k.sessions ? '' : `<div class="note" style="margin-bottom:16px">Ainda não chegou nenhuma sessão nesse período. Confira se o script está instalado no site em <a href="#/settings">Sites e instalação</a>.</div>`}
    <section class="kpis">${K.map(([l, v, dl, help, bad], i) => `<a class="kpi ${bad ? 'bad' : ''}" href="#/kpi/${KPI_KEYS[i]}" ${help ? `title="${esc(help)}"` : ''} aria-label="Detalhar ${esc(l)}"><span class="kpi-ico">${icon(KPI_ICO[i])}</span><div class="kpi-l">${l}</div><div class="kpi-v">${v}${dl}</div></a>`).join('')}</section>
    <section class="panel" style="margin-bottom:16px">
      <div class="panel-head"><h2>Sessões ao longo do tempo</h2><div class="legend"><span><i></i>Sessões</span><span><i class="l3"></i>Converteram</span><span><i class="l2"></i>Com frustração ou erro</span></div></div>
      <div class="only-d">${lineChart(d.series, d.bucket)}</div><div class="only-m">${barChart(d.series, d.bucket)}</div>
    </section>
    <div class="grid g3" style="margin-bottom:16px">
      <section class="panel"><div class="panel-head"><h2>Canais</h2></div>${barList(d.channels, { extra: (r) => `<span class="badge good" title="Conversão">${fmtPct(r.conv, 0)} conv.</span>` })}</section>
      <section class="panel"><div class="panel-head"><h2>Dispositivos</h2></div>${barList(d.devices.map((x) => ({ ...x, k: devName(x.k) })), { extra: (r) => `<span class="badge good" title="Conversão">${fmtPct(r.conv, 0)} conv.</span>` })}</section>
      <section class="panel"><div class="panel-head"><h2>Sites de origem</h2></div>${barList(d.refs)}</section>
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><h2>Páginas de entrada</h2><a class="small" href="#/pages">Comparar páginas</a></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Página</th><th class="n">Entradas</th><th class="n">Conversão</th><th class="n">Rejeição</th><th class="n">Duração</th></tr></thead>
        <tbody>${d.landings.map((r) => `<tr class="click" data-page="${esc(r.k)}"><td class="lbl">${esc(r.k)}</td><td class="n">${fmtInt(r.n)}</td><td class="n">${fmtPct(r.conv, 0)}</td><td class="n">${fmtPct(r.bounce, 0)}</td><td class="n">${fmtDur(r.dur)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem dados</td></tr>'}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Erros de JavaScript mais frequentes</h2></div>
        ${d.errors.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Erro</th><th class="n">Sessões</th><th class="n"></th></tr></thead><tbody>
        ${d.errors.map((r) => `<tr><td><div class="lbl" title="${esc(r.k)}">${esc(r.k)}</div><div class="muted small">${esc(r.path || '')}</div></td><td class="n">${fmtInt(r.sessions)}</td><td class="n"><a class="btn sm" href="#/sessions?errors=1">Ver</a></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="muted small">Nenhum erro registrado no período.</div>'}
      </section>
    </div>`;
  bindChart(el, d.series, d.bucket); bindBars(el);
  $$('tr[data-page]', el).forEach((tr) => (tr.onclick = () => go('#/heatmap?page=' + encodeURIComponent(tr.dataset.page))));
}

// ================================================================ detalhe de um indicador (seta ↗ dos cards)
const pct = (v) => fmtPct(v);
const KPI_INFO = {
  sessions: { t: 'Sessões', fmt: fmtInt, val: (k) => k.sessions, pt: (s) => s.sessions,
    what: 'Cada visita ao site. Uma sessão começa quando a pessoa abre a página e termina depois de 30 minutos sem atividade ou quando ela fecha a aba.',
    how: 'Contagem de sessões registradas pelo script no período. Uma mesma pessoa que volta outro dia conta de novo.',
    read: 'Mede o alcance: quanto tráfego as campanhas e o orgânico estão trazendo. Sozinho não diz se a página funciona; olhe junto com a conversão e a rejeição.',
    act: ['Compare os canais abaixo: o canal que traz muita sessão e pouca conversão é onde investir em criativo ou segmentação.', 'Picos no gráfico costumam coincidir com post, disparo ou anúncio. Anote a causa para repetir o que deu certo.'],
    by: ['channels', 'devices'], col: 'n' },
  visitors: { t: 'Visitantes', fmt: fmtInt, val: (k) => k.visitors,
    what: 'Pessoas diferentes (navegadores únicos) que visitaram o site no período.',
    how: 'Contagem de identificadores de visitante distintos. O identificador fica no navegador: se a pessoa limpar os dados ou trocar de aparelho, conta como outra.',
    read: (k) => `A relação sessões ÷ visitantes é ${(k.sessions / Math.max(1, k.visitors)).toFixed(2).replace('.', ',')}. Perto de 1 = quase todo mundo visita uma vez só; acima de 1,3 = público que volta. ${fmtPct(k.new_visitors, 0)} dos visitantes são novos.`,
    act: ['Muitos visitantes novos e pouca conversão: a página precisa explicar e vender sozinha logo no topo.', 'Visitantes que voltam são quem está decidindo: lembretes (remarketing, e-mail, WhatsApp) costumam converter bem.'],
    by: ['channels', 'devices'], col: 'n' },
  pageviews: { t: 'Pageviews', fmt: fmtInt, val: (k) => k.pageviews, pt: (s) => s.pageviews,
    what: 'Quantas páginas foram vistas no total. Uma sessão que passa por 3 páginas soma 3 pageviews.',
    how: 'Soma das páginas vistas em todas as sessões do período.',
    read: (k) => `Em média, ${(k.pps || 0).toFixed(2).replace('.', ',')} páginas por sessão. Em landing page de uma página só isso fica perto de 1, e tudo bem: o que importa é a conversão.`,
    act: ['Em sites com várias páginas, poucas páginas por sessão indicam que os links internos não chamam atenção.', 'Veja em Páginas quais recebem mais views e se elas levam à conversão.'],
    link: ['#/pages', 'Comparar páginas'] },
  conversion: { t: 'Conversão', short: 'Conversão', fmt: pct, val: (k) => k.conversion, pt: (s) => (s.sessions ? s.converted / s.sessions : null),
    what: 'Parte das sessões que clicou no link de conversão configurado para o site (ex.: o botão que leva à ticketeria).',
    how: (k) => `Sessões com ao menos um clique em link que contém "${esc(site().goal || 'qualquer link externo')}" ÷ total de sessões. No período: ${fmtInt(k.conversions)} de ${fmtInt(k.sessions)} sessões.`,
    read: 'É o número que mais importa numa landing page. Compare por canal e dispositivo: diferenças grandes mostram onde está o problema (público errado, página lenta no celular, CTA escondido).',
    act: ['Garanta um CTA visível sem rolar (no celular, um botão fixo no rodapé ajuda muito).', 'Canal com conversão muito abaixo da média: revise a promessa do anúncio contra o que a página mostra.', 'Use o Mapa de calor para ver onde as pessoas clicam antes de desistir.'],
    by: ['channels', 'devices', 'landings'], col: 'conv', link: ['#/heatmap', 'Abrir mapa de calor'] },
  avg_duration: { t: 'Duração média', short: 'Duração', fmt: fmtDur, val: (k) => k.avg_duration,
    what: 'Tempo médio que a página ficou aberta e visível na tela por sessão.',
    how: 'Média do tempo com a aba visível. Abas esquecidas em segundo plano não contam.',
    read: 'Pouco tempo + alta rejeição = a pessoa não encontrou o que esperava. Muito tempo + baixa conversão = interesse existe, mas algo trava a decisão (preço, dúvida, CTA).',
    act: ['Se a duração é baixa, olhe o topo: título, promessa e CTA precisam aparecer nos primeiros segundos.', 'Se é alta e não converte, veja as perguntas mais abertas do FAQ e responda perto do botão.'],
    by: ['devices', 'landings'], col: 'dur', colFmt: fmtDur },
  bounce: { t: 'Taxa de rejeição', short: 'Rejeição', fmt: pct, val: (k) => k.bounce, invert: true,
    what: 'Sessões que viram uma página só e saíram sem clicar no link de conversão.',
    how: 'Sessões com 1 pageview e sem conversão ÷ total de sessões. Quem clicou na conversão nunca conta como rejeição.',
    read: 'Quanto menor, melhor. Em landing page é normal ser alta, porque só existe uma página; o sinal de alerta é a rejeição subir de um período para o outro ou ser muito maior num canal.',
    act: ['Rejeição alta num canal específico: problema de público ou de promessa do anúncio.', 'Rejeição alta no mobile: confira velocidade e se o CTA aparece sem rolar.'],
    by: ['channels', 'devices', 'landings'], col: 'bounce', invertCol: true },
  scroll: { t: 'Scroll médio', fmt: (v) => (v == null ? '—' : Math.round(v) + '%'), val: (k) => k.scroll,
    what: 'Até onde, em média, as pessoas rolam a página (0% = só viu o topo, 100% = chegou ao fim).',
    how: 'Para cada página vista, o ponto mais baixo alcançado ÷ altura total da página. Depois, a média de todas.',
    read: 'Mostra se o conteúdo prende. Scroll baixo significa que a maioria decide só pelo que vê no topo, então o que estiver mais abaixo (preço, line-up, FAQ) quase não é visto.',
    act: ['Leve para cima o que mais vende (preço, data, destaque principal).', 'Repita o CTA ao longo da página para quem rola.', 'O Mapa de calor mostra em que altura as pessoas param.'],
    link: ['#/heatmap', 'Ver onde as pessoas param'] },
  activity: { t: 'Taxa de atividade', fmt: (v) => fmtPct(v, 0), val: (k) => k.activity,
    what: 'Parte do tempo na página em que a pessoa estava de fato interagindo: mexendo o mouse, tocando, rolando ou digitando.',
    how: 'Tempo ativo ÷ tempo total de cada página vista, em média.',
    read: 'Atividade alta = a pessoa está explorando. Atividade baixa com duração alta = página aberta "parada" (vídeo tocando, pessoa distraída).',
    act: ['Se é baixa, elementos interativos (carrossel, abas, FAQ) podem estar escondidos ou pouco convidativos.', 'Compare com as sessões gravadas para entender o comportamento.'],
    link: ['#/sessions', 'Ver sessões'] },
  rage: { t: 'Sessões com rage click', fmt: pct, val: (k) => k.rage, invert: true,
    what: 'Sessões em que a pessoa clicou 3 ou mais vezes rápido no mesmo ponto. É o sinal clássico de frustração: ela esperava que algo acontecesse e não aconteceu.',
    how: 'Sessões com ao menos um rage click ÷ total de sessões.',
    read: 'Acima de 5% merece atenção. Normalmente são imagens que parecem botão, botões lentos ou elementos que não respondem no celular.',
    act: ['Abra as sessões com frustração e veja onde aconteceu.', 'No Mapa de calor, os pontos com muito clique e nenhum link são candidatos a virar link ou deixar de parecer clicáveis.'],
    link: ['#/sessions?frustration=1', 'Ver sessões com frustração'] },
  errors: { t: 'Sessões com erro JS', fmt: pct, val: (k) => k.errors, invert: true,
    what: 'Sessões em que aconteceu algum erro de JavaScript ou falha ao carregar arquivo (script, vídeo, imagem).',
    how: 'Sessões com ao menos um erro registrado ÷ total de sessões.',
    read: 'Nem todo erro é do seu site: navegadores dentro do Instagram/Facebook e bloqueadores de anúncio geram ruído. Olhe os erros que se repetem em muitas sessões e que apontam para arquivos do próprio site.',
    act: ['Comece pelos erros com mais sessões na lista abaixo.', 'Falha ao carregar vídeo/imagem: confira caminho e tamanho do arquivo.', 'Scripts de terceiros que falham sempre (ferramentas antigas) podem ser removidos.'],
    list: 'errors', link: ['#/sessions?errors=1', 'Ver sessões com erro'] },
};

async function renderKpi(el, alive, key) {
  const info = KPI_INFO[key];
  if (!info) { go('#/overview'); return; }
  const d = await api('overview', baseParams());
  if (!alive()) return;
  const k = d.kpis, p = d.prev || {};
  const t = key === 'conversion' ? (site().goal_label || info.t) : info.t;
  const v = info.val(k), pv = info.val(p);
  const txt = (x) => (typeof x === 'function' ? x(k) : x);
  const avg = (rows, col) => rows.reduce((a, r) => a + (r[col] || 0) * r.n, 0) / Math.max(1, rows.reduce((a, r) => a + r.n, 0));
  const NAMES = { channels: 'Por canal', devices: 'Por dispositivo', landings: 'Por página de entrada' };
  const rowsOf = (b) => (b === 'devices' ? d.devices.map((x) => ({ ...x, k: devName(x.k) })) : d[b] || []);
  const breakdown = (b) => {
    const rows = rowsOf(b);
    if (!rows.length) return '';
    if (info.col === 'n' || !info.col) return `<section class="panel"><div class="panel-head"><h2>${NAMES[b]}</h2></div>${barList(rows)}</section>`;
    const f = info.colFmt || ((x) => fmtPct(x, 0)), m = avg(rows, info.col);
    const worse = (x) => (info.invertCol ? x > m * 1.15 : x < m * 0.85), better = (x) => (info.invertCol ? x < m * 0.85 : x > m * 1.15);
    return `<section class="panel"><div class="panel-head"><h2>${NAMES[b]}</h2><span class="muted small">média ${f(m)}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${b === 'landings' ? 'Página' : 'Segmento'}</th><th class="n">Sessões</th><th class="n">${info.short || "Valor"}</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="lbl">${esc(r.k)}</td><td class="n">${fmtInt(r.n)}</td><td class="n"><span class="badge ${better(r[info.col]) ? 'good' : worse(r[info.col]) ? 'bad' : ''}">${f(r[info.col])}</span></td></tr>`).join('')}
      </tbody></table></div></section>`;
  };
  const pts = info.pt ? d.series.map((s) => ({ b: s.b, v: info.pt(s) })) : null;
  const trend = () => {
    if (!pts || !pts.length) return '';
    const max = Math.max(1e-9, ...pts.map((x) => x.v || 0));
    const lab = (b) => { const dt = new Date(b); return d.bucket === 'hour' ? dt.getHours() + 'h' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
    return `<section class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>${esc(t)} ao longo do tempo</h2></div>
      <div class="kpi-trend">${pts.map((x) => `<div class="kt" title="${lab(x.b)}: ${x.v == null ? '—' : info.fmt(x.v)}"><i style="height:${Math.max(2, ((x.v || 0) / max) * 100)}%"></i><span>${lab(x.b)}</span></div>`).join('')}</div></section>`;
  };
  if ($('#appbar-t')) $('#appbar-t').textContent = t;
  const prevTxt = pv == null || isNaN(pv) ? 'sem dados do período anterior' : `período anterior: <b>${info.fmt(pv)}</b>`;
  el.innerHTML = `
    <div class="page-head"><div><a class="small" href="#/overview">← Visão geral</a><h1>${esc(t)}</h1><p>${esc(site().name)}: o que este número significa e como melhorar.</p></div>
      ${info.link ? `<a class="btn" href="${info.link[0]}">${esc(info.link[1])}</a>` : ''}</div>
    <section class="kpi-hero panel" style="margin-bottom:16px">
      <div class="kpi-v">${v == null || isNaN(v) ? '—' : info.fmt(v)} ${delta(v, pv, !!info.invert)}</div>
      <div class="muted">${prevTxt}</div>
    </section>
    ${trend()}
    <div class="grid g3" style="margin-bottom:16px">
      <section class="panel"><div class="panel-head"><h2>O que é</h2></div><p>${txt(info.what)}</p></section>
      <section class="panel"><div class="panel-head"><h2>Como é calculado</h2></div><p>${txt(info.how)}</p></section>
      <section class="panel"><div class="panel-head"><h2>Como ler</h2></div><p>${txt(info.read)}</p></section>
    </div>
    <section class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>O que fazer para melhorar</h2></div>
      <ul class="kpi-act">${info.act.map((a) => `<li>${a}</li>`).join('')}</ul></section>
    <div class="grid g2">${(info.by || []).map(breakdown).join('')}
      ${info.list === 'errors' ? `<section class="panel"><div class="panel-head"><h2>Erros mais frequentes</h2></div>${d.errors.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Erro</th><th class="n">Sessões</th></tr></thead><tbody>${d.errors.map((r) => `<tr><td><div class="lbl" title="${esc(r.k)}">${esc(r.k)}</div><div class="muted small">${esc(r.path || '')}</div></td><td class="n">${fmtInt(r.sessions)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">Nenhum erro no período.</div>'}</section>` : ''}
    </div>`;
}

// ================================================================ páginas (comparador)
const PAGE_COLS = [
  ['label', 'Página'], ['views', 'Views', 'n'], ['landings', 'Entradas', 'n'], ['bounce', 'Rejeição', 'p', true],
  ['exit', 'Saída', 'p', true], ['avg_time', 'Tempo médio', 'd'], ['scroll', 'Scroll', 's'], ['activity', 'Atividade', 'p'],
  ['conv', 'Conversão', 'p'], ['clicks', 'Cliques/view', 'f'], ['frustr', 'Frustração', 'p', true], ['err', 'Erro JS', 'p', true], ['uturn', 'Volta rápida', 'p', true],
];
let pageSort = store.get('pageSort', ['views', -1]);
async function renderPages(el, alive) {
  const { rows } = await api('pages', baseParams());
  if (!alive()) return;
  rows.forEach((r) => {
    r.bounce = r.landings ? r.bounces / r.landings : null;
    r.exit = r.views ? r.exits / r.views : null;
    r.frustr = r.views ? (r.rage_pv + r.dead_pv) / r.views : 0;
    r.err = r.views ? r.err_pv / r.views : 0;
    r.conv = r.views ? r.goal_pv / r.views : 0;
    r.uturn = r.views ? r.uturns / r.views : 0;
  });
  const maxViews = Math.max(1, ...rows.map((r) => r.views));
  const colorBad = (v) => (v == null ? '' : `background:${v > 0.15 ? 'var(--bad-soft)' : v > 0.05 ? 'var(--warn-soft)' : 'transparent'}`);
  const cell = (r, [k, , t, bad]) => {
    const v = r[k];
    if (k === 'label') return `<td class="lbl" title="${esc(v)}">${esc(v)}</td>`;
    if (k === 'views') return `<td class="n bar-cell"><i class="b" style="width:${(v / maxViews) * 100}%"></i><span>${fmtInt(v)}</span></td>`;
    const txt = t === 'n' ? fmtInt(v) : t === 'p' ? fmtPct(v, 0) : t === 'd' ? fmtDur(v) : t === 's' ? (v == null ? '—' : Math.round(v) + '%') : (v || 0).toFixed(1).replace('.', ',');
    return `<td class="n">${bad ? `<span class="heatcell" style="${colorBad(v)}">${txt}</span>` : txt}</td>`;
  };
  const draw = () => {
    const [sk, dir] = pageSort;
    const sorted = [...rows].sort((a, b) => (sk === 'label' ? String(a.label).localeCompare(b.label) * dir : ((a[sk] ?? -1) - (b[sk] ?? -1)) * dir));
    el.innerHTML = `
      <div class="page-head"><div><h1>Páginas</h1><p>Compare o desempenho de cada página. Clique numa linha para abrir o mapa de calor.</p></div></div>
      <section class="panel">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${PAGE_COLS.map(([k, l, t]) => `<th class="sort ${t ? 'n' : ''} ${sk === k ? 'on' : ''}" data-k="${k}">${l}${sk === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}<th></th></tr></thead>
      <tbody>${sorted.map((r) => `<tr class="click" data-page="${esc(r.label)}">${PAGE_COLS.map((c) => cell(r, c)).join('')}<td class="n"><a class="btn sm" href="#/sessions?page=${encodeURIComponent(r.label)}" data-stop>Sessões</a></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><h2>Sem páginas no período</h2>Quando o script receber visitas, as páginas aparecem aqui.</div>'}</section>
      <p class="muted small">Conversão: views em que a pessoa clicou no link de conversão (${esc(site().goal || 'qualquer link externo')}). Quem converte não conta como rejeição nem como saída. Frustração: views com rage click ou clique sem resposta. Volta rápida: o visitante abriu a página e voltou para a anterior em menos de 10s.</p>`;
    $$('th.sort', el).forEach((th) => (th.onclick = () => { pageSort = [th.dataset.k, pageSort[0] === th.dataset.k ? -pageSort[1] : -1]; store.set('pageSort', pageSort); draw(); }));
    $$('tr[data-page]', el).forEach((tr) => (tr.onclick = (e) => { if (e.target.closest('[data-stop]')) return; go('#/heatmap?page=' + encodeURIComponent(tr.dataset.page)); }));
  };
  draw();
}

// ================================================================ sessões
const SESS_FILTERS = [['replay', 'Com gravação'], ['converted', 'Converteram'], ['notconverted', 'Não converteram'], ['frustration', 'Com frustração'], ['errors', 'Com erro JS'], ['bounce', 'Rejeição'], ['new', 'Visitantes novos']];
async function renderSessions(el, alive, q) {
  const f = Object.fromEntries(SESS_FILTERS.map(([k]) => [k, q.get(k) === '1']));
  const text = { page: q.get('page') || '', source: q.get('source') || '', min_dur: q.get('min_dur') || '' };
  let offset = 0, rows = [], total = 0;
  el.innerHTML = `
    <div class="page-head"><div><h1>Sessões</h1><p>Cada visita, na ordem em que aconteceu. Abra uma sessão para assistir à gravação.</p></div></div>
    <div class="filters">
      ${SESS_FILTERS.map(([k, l]) => `<button class="chip ${f[k] ? 'on' : ''}" data-f="${k}" aria-pressed="${f[k]}">${l}</button>`).join('')}
      <input class="inp" id="fs-page" placeholder="Visitou a página…" value="${esc(text.page)}" style="width:190px">
      <input class="inp" id="fs-src" placeholder="Origem ou utm_source" value="${esc(text.source)}" style="width:170px">
      <select class="sel" id="fs-dur"><option value="">Qualquer duração</option>${[10, 30, 60, 180].map((s) => `<option value="${s}" ${+text.min_dur === s ? 'selected' : ''}>Mais de ${s < 60 ? s + 's' : s / 60 + 'min'}</option>`).join('')}</select>
    </div>
    <section class="panel" id="sess-box"><div class="loading"><span class="spin"></span></div></section>`;
  const apply = () => {
    const p = new URLSearchParams();
    for (const [k] of SESS_FILTERS) if (f[k]) p.set(k, '1');
    if ($('#fs-page').value) p.set('page', $('#fs-page').value);
    if ($('#fs-src').value) p.set('source', $('#fs-src').value);
    if ($('#fs-dur').value) p.set('min_dur', $('#fs-dur').value);
    go('#/sessions' + (p.toString() ? '?' + p : ''));
  };
  $$('[data-f]', el).forEach((b) => (b.onclick = () => { f[b.dataset.f] = !f[b.dataset.f]; apply(); }));
  let tmr; ['#fs-page', '#fs-src'].forEach((s) => ($(s).oninput = () => { clearTimeout(tmr); tmr = setTimeout(apply, 600); }));
  $('#fs-dur').onchange = apply;

  const load = async () => {
    const params = baseParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v).map(([k]) => [k, 1])), ...text, limit: 50, offset });
    const d = await api('sessions', params);
    if (!alive()) return;
    rows = rows.concat(d.rows); total = d.total;
    draw();
  };
  const draw = () => {
    const box = $('#sess-box');
    if (!rows.length) { box.innerHTML = '<div class="empty"><h2>Nenhuma sessão com esses filtros</h2>Tente um período maior ou tire algum filtro.</div>'; return; }
    box.innerHTML = `<div class="panel-head"><h2>${fmtInt(total)} sessões</h2></div>
      <div class="tbl-wrap"><table class="tbl sess-tbl"><thead><tr><th>Início</th><th>Duração</th><th>Páginas visitadas</th><th>Origem</th><th>Sinais</th><th></th></tr></thead><tbody>
      ${rows.map((s) => `<tr class="click sess-row" data-id="${s.id}">
        <td><div>${fmtDate(s.started_at)}</div><div class="muted small">${devIcon(s.device)} ${esc(s.browser || '')}${s.is_new ? '' : ', recorrente'}</div></td>
        <td class="num">${fmtDur(s.duration_ms)}</td>
        <td><div class="path-crumbs">${(s.paths || []).slice(0, 4).map((p) => `<span title="${esc(p)}">${esc(p)}</span>`).join('<em>›</em>')}${s.pageviews > 4 ? `<em>+${s.pageviews - 4}</em>` : ''}</div></td>
        <td class="small">${esc(s.utm_source || (s.referrer ? s.referrer.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Direto'))}</td>
        <td>${s.conv ? `<span class="badge good">converteu</span> ` : ''}${s.rage_clicks ? `<span class="badge bad">${s.rage_clicks} rage</span> ` : ''}${s.dead_clicks ? `<span class="badge warn">${s.dead_clicks} sem resposta</span> ` : ''}${s.errors ? `<span class="badge bad">${s.errors} erro${s.errors > 1 ? 's' : ''}</span>` : ''}</td>
        <td class="n">${s.has_replay ? `<span class="btn sm primary">${icon('play')} Assistir</span>` : '<span class="muted small">sem gravação</span>'}</td>
      </tr>`).join('')}</tbody></table></div>
      ${rows.length < total ? `<div style="text-align:center;margin-top:14px"><button class="btn" id="more">Carregar mais</button></div>` : ''}`;
    $$('tr[data-id]', box).forEach((tr) => (tr.onclick = () => {
      sessionStorage.setItem('rastro_list', JSON.stringify(rows.map((r) => r.id)));
      go('#/session/' + tr.dataset.id);
    }));
    const m = $('#more'); if (m) m.onclick = () => { offset += 50; m.disabled = true; load(); };
  };
  await load();
}

// ================================================================ sites e instalação
async function renderSettings(el, alive, arg) {
  await reloadSites();
  if (!alive()) return;
  const cur = S.sites.find((s) => s.id === (arg || S.siteId)) || null;
  const snippet = (s) => `<script src="${SCRIPT_URL}"${SNIPPET_API ? ` data-api="${SNIPPET_API}"` : ''} data-key="${s.site_key}" defer></script>`;
  el.innerHTML = `
    <div class="page-head"><div><h1>Sites e instalação</h1><p>Cadastre cada site de cliente, copie o script e defina como as páginas são agrupadas.</p></div>
      <button class="btn primary" id="new-site">${icon('plus')} Novo site</button></div>
    ${S.sites.length ? `
    <div class="grid" style="grid-template-columns:260px minmax(0,1fr)">
      <section class="panel"><div class="site-pick">${S.sites.map((s) => `<button data-id="${s.id}" class="${cur && cur.id === s.id ? 'on' : ''}"><b>${esc(s.name)}</b><small>${s.last_seen ? 'Última visita ' + fmtDate(s.last_seen).toLowerCase() : 'Aguardando a primeira visita'}</small></button>`).join('')}</div></section>
      <div id="site-detail"></div>
    </div>` : `<section class="panel empty" id="first"><h2>Cadastre o primeiro site</h2><p>Depois é só colar uma linha de script no site do cliente.</p></section>`}`;
  $('#new-site').onclick = () => siteForm(null);
  $$('.site-pick button', el).forEach((b) => (b.onclick = () => go('#/settings/' + b.dataset.id)));
  if (!S.sites.length) { siteForm(null, $('#first')); return; }
  if (cur) await siteDetail(cur);

  function siteForm(s, target = $('#site-detail')) {
    const isNew = !s; s = s || { name: '', domains: [], replay_sample: 1, mask_text: false, replay_days: 30, data_days: 180, goal: '', goal_label: 'Clicou na ticketeria' };
    target.innerHTML = `<section class="panel" style="text-align:left">
      <div class="panel-head"><h2>${isNew ? 'Novo site' : 'Editar ' + esc(s.name)}</h2></div>
      <form id="sf" class="form-grid">
        <div class="field"><label for="sf-name">Nome</label><input class="inp" id="sf-name" required value="${esc(s.name)}" placeholder="Ex.: Fornalha Tour"></div>
        <div class="field"><label for="sf-dom">Domínios autorizados</label><input class="inp" id="sf-dom" value="${esc((s.domains || []).join(', '))}" placeholder="exemplo.com.br, loja.exemplo.com.br"><span class="hint">Subdomínios entram automaticamente. Deixe vazio para aceitar qualquer domínio.</span></div>
        <div class="field"><label for="sf-goal">Link de conversão</label><input class="inp" id="sf-goal" value="${esc(s.goal || '')}" placeholder="sympla.com.br, ingresse.com"><span class="hint">Cliques em links que contenham esses textos contam como conversão e não como rejeição. Vazio: qualquer link para fora do site.</span></div>
        <div class="field"><label for="sf-goal-l">Nome da conversão</label><input class="inp" id="sf-goal-l" value="${esc(s.goal_label || 'Clicou na ticketeria')}" placeholder="Clicou na ticketeria"><span class="hint">Aparece nos relatórios, na jornada e no funil.</span></div>
        <div class="field"><label for="sf-rs">Sessões gravadas</label><select class="sel" id="sf-rs">${[1, 0.5, 0.25, 0.1, 0].map((v) => `<option value="${v}" ${+s.replay_sample === v ? 'selected' : ''}>${v ? Math.round(v * 100) + '% das sessões' : 'Não gravar (só mapas e métricas)'}</option>`).join('')}</select><span class="hint">Gravar menos sessões economiza armazenamento em sites com muito tráfego.</span></div>
        <div class="field"><label>Privacidade</label><label class="toggle"><input type="checkbox" id="sf-mt" ${s.mask_text ? 'checked' : ''}> Esconder todo o texto das gravações</label><span class="hint">Campos de formulário já são sempre mascarados. Para esconder um trecho específico, adicione a classe <code>rastro-mask</code> no elemento.</span></div>
        <div class="field"><label for="sf-rd">Guardar gravações por</label><select class="sel" id="sf-rd">${[7, 15, 30, 60, 90].map((v) => `<option value="${v}" ${+s.replay_days === v ? 'selected' : ''}>${v} dias</option>`).join('')}</select></div>
        <div class="field"><label for="sf-dd">Guardar métricas por</label><select class="sel" id="sf-dd">${[90, 180, 365, 730].map((v) => `<option value="${v}" ${+s.data_days === v ? 'selected' : ''}>${v < 365 ? v + ' dias' : v / 365 + (v > 365 ? ' anos' : ' ano')}</option>`).join('')}</select></div>
        <div class="full" style="display:flex;gap:8px;justify-content:space-between">
          <div style="display:flex;gap:8px"><button class="btn primary" type="submit">${isNew ? 'Criar site' : 'Salvar alterações'}</button>${isNew && S.sites.length ? '<button class="btn ghost" type="button" id="sf-cancel">Cancelar</button>' : ''}</div>
          ${isNew ? '' : `<button class="btn danger" type="button" id="sf-del">${icon('trash')} Excluir site</button>`}
        </div>
      </form></section>`;
    const c = $('#sf-cancel'); if (c) c.onclick = () => route();
    $('#sf').onsubmit = async (e) => {
      e.preventDefault();
      const body = { name: $('#sf-name').value, domains: $('#sf-dom').value, replay_sample: +$('#sf-rs').value, mask_text: $('#sf-mt').checked, replay_days: +$('#sf-rd').value, data_days: +$('#sf-dd').value, goal: $('#sf-goal').value, goal_label: $('#sf-goal-l').value };
      try {
        const r = isNew ? await api('sites', {}, { method: 'POST', body }) : await api('sites/' + s.id, {}, { method: 'PUT', body });
        S.siteId = r.id; store.set('site', r.id);
        toast(isNew ? 'Site criado' : 'Alterações salvas');
        go('#/settings/' + r.id); if (!isNew) route();
      } catch (er) { toast(er.message); }
    };
    const del = $('#sf-del');
    if (del) del.onclick = async () => {
      if (!confirm(`Excluir "${s.name}" e todos os dados e gravações dele? Isso não pode ser desfeito.`)) return;
      await api('sites/' + s.id, {}, { method: 'DELETE' });
      toast('Site excluído'); S.siteId = null; go('#/settings');
    };
  }

  async function siteDetail(s) {
    const box = $('#site-detail');
    const { rows: groups } = await api('groups', { site: s.id });
    box.innerHTML = `
      <section class="panel" style="margin-bottom:16px">
        <div class="panel-head"><h2>Instalação em ${esc(s.name)}</h2><button class="btn sm" id="edit">Editar site</button></div>
        <p style="margin-top:0">Cole esta linha antes do <code>&lt;/head&gt;</code> de todas as páginas. No WordPress, use o WPCode (Header) ou o <code>header.php</code> do tema.</p>
        <div class="snippet" id="snip">${esc(snippet(s))}<button class="btn sm" id="copy">${icon('copy')} Copiar</button></div>
        <p class="muted small" style="margin-bottom:0">${s.domains?.length ? 'Aceita dados de: ' + s.domains.map(esc).join(', ') + ' (e subdomínios).' : 'Aceita dados de qualquer domínio. Restrinja em "Editar site" depois de instalar.'}
          Gravando ${Math.round(s.replay_sample * 100)}% das sessões, guardadas por ${s.replay_days} dias.
          Conversão (${esc(s.goal_label || '')}): clique em ${s.goal ? 'links com ' + esc(s.goal) : 'qualquer link para fora do site'}.
          ${s.last_seen ? `Última visita recebida: ${fmtDate(s.last_seen).toLowerCase()}.` : '<b>Ainda não recebemos nenhuma visita.</b> Depois de instalar, abra o site numa aba anônima e volte aqui.'}</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Agrupamento de páginas</h2></div>
        <p style="margin-top:0" class="muted">Junte URLs parecidas numa só página nos relatórios. Por exemplo, todos os <code>/produto/...</code> como "Produto". A primeira regra que combinar vale.</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome do grupo</th><th>Regra</th><th>Padrão</th><th></th></tr></thead><tbody>
          ${groups.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td>${{ prefix: 'Começa com', exact: 'É igual a', contains: 'Contém', regex: 'Regex' }[g.match_type]}</td><td><code>${esc(g.pattern)}</code></td><td class="n"><button class="btn sm ghost danger" data-del="${g.id}" aria-label="Remover grupo">${icon('trash')}</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum agrupamento. Os relatórios mostram cada URL separada.</td></tr>'}
        </tbody></table></div>
        <form id="gf" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
          <input class="inp" id="g-name" placeholder="Nome (ex.: Produto)" required style="flex:1;min-width:140px">
          <select class="sel" id="g-type"><option value="prefix">Começa com</option><option value="contains">Contém</option><option value="exact">É igual a</option><option value="regex">Regex</option></select>
          <input class="inp" id="g-pat" placeholder="/produto/" required style="flex:1;min-width:140px">
          <button class="btn" type="submit">${icon('plus')} Adicionar</button>
        </form>
      </section>`;
    $('#edit').onclick = () => siteForm(s);
    $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(snippet(s)); toast('Script copiado'); } catch { toast('Selecione e copie manualmente'); } };
    $('#gf').onsubmit = async (e) => {
      e.preventDefault();
      await api('groups', {}, { method: 'POST', body: { site_id: s.id, name: $('#g-name').value, match_type: $('#g-type').value, pattern: $('#g-pat').value } });
      toast('Grupo adicionado'); await loadGroupsCount(); siteDetail(s);
    };
    $$('[data-del]', box).forEach((b) => (b.onclick = async () => { await api('groups/' + b.dataset.del, {}, { method: 'DELETE' }); await loadGroupsCount(); siteDetail(s); }));
  }
}

boot();
