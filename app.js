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
function renderShell() {
  document.getElementById('app').innerHTML = `
  <div class="shell">
    <aside class="rail">
      <a class="brand" href="#/overview"><span class="brand-mark"></span><span>Rastro</span></a>
      <nav class="nav">${NAV.map(([k, l]) => (k === '#' ? `<div class="lbl-sec">${l}</div>` : `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`)).join('')}</nav>
      <div class="rail-foot"><button id="theme">Tema</button><button id="out">Sair</button></div>
    </aside>
    <div class="main">
      <div class="topbar" id="topbar"></div>
      <main class="content" id="view"></main>
    </div>
  </div>`;
  $('#out').onclick = logout;
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', document.documentElement.dataset.theme);
  };
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
    <button class="btn sm ghost" id="sync-b" title="Traz as visitas mais recentes para os relatórios">Atualizar dados</button>`;
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
  $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.k === view || (view === 'session' && a.dataset.k === 'sessions')));
  renderTopbar(view);
  const el = $('#view');
  if (!S.sites.length && view !== 'settings') { go('#/settings'); return; }
  el.innerHTML = '<div class="loading"><span class="spin"></span></div>';
  const alive = () => my === routeToken;
  try {
    switch (view) {
      case 'overview': await renderOverview(el, alive); break;
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
    <section class="kpis">${K.map(([l, v, dl, help, bad]) => `<div class="kpi ${bad ? 'bad' : ''}" ${help ? `title="${esc(help)}"` : ''}><div class="kpi-l">${l}</div><div class="kpi-v">${v}${dl}</div></div>`).join('')}</section>
    <section class="panel" style="margin-bottom:16px">
      <div class="panel-head"><h2>Sessões ao longo do tempo</h2><div class="legend"><span><i></i>Sessões</span><span><i class="l3"></i>Converteram</span><span><i class="l2"></i>Com frustração ou erro</span></div></div>
      ${lineChart(d.series, d.bucket)}
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
  bindChart(el, d.series, d.bucket);
  $$('tr[data-page]', el).forEach((tr) => (tr.onclick = () => go('#/heatmap?page=' + encodeURIComponent(tr.dataset.page))));
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
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Início</th><th>Duração</th><th>Páginas visitadas</th><th>Origem</th><th>Sinais</th><th></th></tr></thead><tbody>
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
