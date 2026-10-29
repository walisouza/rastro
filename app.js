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

// Ícones: Tabler Icons (tabler.io/icons, MIT), versão outline
export const ICON = {
  overview: '<path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1"/><path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1"/><path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1"/><path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1"/>',
  pages: '<path d="M15 3v4a1 1 0 0 0 1 1h4"/><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z"/><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"/>',
  heatmap: '<path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235"/>',
  journey: '<path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4z"/><path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5"/>',
  funnel: '<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z"/>',
  sessions: '<path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z"/><path d="M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/>',
  settings: '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  desktop: '<path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10z"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>',
  mobile: '<path d="M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14z"/><path d="M11 4h2"/><path d="M12 17v.01"/>',
  tablet: '<path d="M5 4a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-16z"/><path d="M11 17a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/>',
  copy: '<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>',
  play: '<path d="M7 4v16l13 -8z"/>',
  back: '<path d="M15 6l-6 6l6 6"/>',
  plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  trash: '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  more: '<path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  users: '<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>',
  eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>',
  target: '<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  exit: '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>',
  scroll: '<path d="M6 3m0 4a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-4a4 4 0 0 1 -4 -4z"/><path d="M12 7l0 4"/>',
  pulse: '<path d="M3 12h4l3 8l4 -16l3 8h4"/>',
  zap: '<path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5"/><path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47"/><path d="M5 3l-1 -1"/><path d="M4 7h-1"/><path d="M14 3l1 -1"/><path d="M15 6h1"/>',
  bug: '<path d="M9 9v-1a3 3 0 0 1 6 0v1"/><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3"/><path d="M3 13l4 0"/><path d="M17 13l4 0"/><path d="M12 20l0 -6"/><path d="M4 19l3.35 -2"/><path d="M20 19l-3.35 -2"/><path d="M4 7l3.75 2.4"/><path d="M20 7l-3.75 2.4"/>',
  sun: '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>',
  moon: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  arrow: '<path d="M17 7l-10 10"/><path d="M8 7l9 0l0 9"/>',
};
// versões preenchidas (Tabler filled); onde não existe, usa a outline acima
export const ICON_F = {
  overview: '<path d="M9 3a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zm10 -4a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 -8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z"/>',
  pages: '<path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005h5z"/><path d="M19 7h-4l-.001 -4.001z"/>',
  heatmap: '<path d="M10 2c0 -.88 1.056 -1.331 1.692 -.722c1.958 1.876 3.096 5.995 1.75 9.12l-.08 .174l.012 .003c.625 .133 1.203 -.43 2.303 -2.173l.14 -.224a1 1 0 0 1 1.582 -.153c1.334 1.435 2.601 4.377 2.601 6.27c0 4.265 -3.591 7.705 -8 7.705s-8 -3.44 -8 -7.706c0 -2.252 1.022 -4.716 2.632 -6.301l.605 -.589c.241 -.236 .434 -.43 .618 -.624c1.43 -1.512 2.145 -2.924 2.145 -4.78"/>',
  journey: '<path d="M11.092 2.581a1 1 0 0 1 1.754 -.116l.062 .116l8.005 17.365c.198 .566 .05 1.196 -.378 1.615a1.53 1.53 0 0 1 -1.459 .393l-7.077 -2.398l-6.899 2.338a1.535 1.535 0 0 1 -1.52 -.231l-.112 -.1c-.398 -.386 -.556 -.954 -.393 -1.556l.047 -.15l7.97 -17.276z"/>',
  funnel: '<path d="M20 3h-16a1 1 0 0 0 -1 1v2.227l.008 .223a3 3 0 0 0 .772 1.795l4.22 4.641v8.114a1 1 0 0 0 1.316 .949l6 -2l.108 -.043a1 1 0 0 0 .576 -.906v-6.586l4.121 -4.12a3 3 0 0 0 .879 -2.123v-2.171a1 1 0 0 0 -1 -1z"/>',
  sessions: '<path d="M20.117 7.625a1 1 0 0 0 -.564 .1l-4.553 2.275v4l4.553 2.275a1 1 0 0 0 1.447 -.892v-6.766a1 1 0 0 0 -.883 -.992z"/><path d="M5 5c-1.645 0 -3 1.355 -3 3v8c0 1.645 1.355 3 3 3h8c1.645 0 3 -1.355 3 -3v-8c0 -1.645 -1.355 -3 -3 -3z"/>',
  settings: '<path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z"/>',
  desktop: '<path d="M7 21a1 1 0 0 1 0 -2h1v-2h-4a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-4v2h1a1 1 0 0 1 0 2zm7 -4h-4v2h4z"/>',
  mobile: '<path d="M16 2a3 3 0 0 1 2.995 2.824l.005 .176v14a3 3 0 0 1 -2.824 2.995l-.176 .005h-8a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005h8zm-4 14a1 1 0 0 0 -.993 .883l-.007 .117l.007 .127a1 1 0 0 0 1.986 0l.007 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm1 -12h-2l-.117 .007a1 1 0 0 0 0 1.986l.117 .007h2l.117 -.007a1 1 0 0 0 0 -1.986l-.117 -.007z"/>',
  tablet: '<path d="M18 2a2 2 0 0 1 1.995 1.85l.005 .15v16a2 2 0 0 1 -1.85 1.995l-.15 .005h-12a2 2 0 0 1 -1.995 -1.85l-.005 -.15v-16a2 2 0 0 1 1.85 -1.995l.15 -.005h12zm-6 13a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15z"/>',
  copy: '<path d="M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-3.997 -2.17a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z"/>',
  play: '<path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z"/>',
  plus: '<path d="M4.929 4.929a10 10 0 1 1 14.141 14.141a10 10 0 0 1 -14.14 -14.14zm8.071 4.071a1 1 0 1 0 -2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0 -2h-2v-2z"/>',
  trash: '<path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16z"/><path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z"/>',
  users: '<path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/>',
  eye: '<path d="M12 4c4.29 0 7.863 2.429 10.665 7.154l.22 .379l.045 .1l.03 .083l.014 .055l.014 .082l.011 .1v.11l-.014 .111a.992 .992 0 0 1 -.026 .11l-.039 .108l-.036 .075l-.016 .03c-2.764 4.836 -6.3 7.38 -10.555 7.499l-.313 .004c-4.396 0 -8.037 -2.549 -10.868 -7.504a1 1 0 0 1 0 -.992c2.831 -4.955 6.472 -7.504 10.868 -7.504zm0 5a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z"/>',
  target: '<path d="M3.039 4.277l3.904 13.563c.185 .837 .92 1.516 1.831 1.642l.17 .016a2.2 2.2 0 0 0 1.982 -1.006l.045 -.078l1.4 -2.072l4.05 4.05a2.067 2.067 0 0 0 2.924 0l1.047 -1.047c.388 -.388 .606 -.913 .606 -1.461l-.008 -.182a2.067 2.067 0 0 0 -.598 -1.28l-4.047 -4.048l2.103 -1.412c.726 -.385 1.18 -1.278 1.053 -2.189a2.2 2.2 0 0 0 -1.701 -1.845l-13.524 -3.89a1 1 0 0 0 -1.236 1.24z"/>',
  clock: '<path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66a1 1 0 0 0 -.993 .883l-.007 .117v5l.009 .131a1 1 0 0 0 .197 .477l.087 .1l3 3l.094 .082a1 1 0 0 0 1.226 0l.094 -.083l.083 -.094a1 1 0 0 0 0 -1.226l-.083 -.094l-2.707 -2.708v-4.585l-.007 -.117a1 1 0 0 0 -.993 -.883z"/>',
  exit: '<path d="M9.586 4l-6.586 6.586a2 2 0 0 0 0 2.828l6.586 6.586a2 2 0 0 0 2.18 .434l.145 -.068a2 2 0 0 0 1.089 -1.78v-2.586h7a2 2 0 0 0 2 -2v-4l-.005 -.15a2 2 0 0 0 -1.995 -1.85l-7 -.001v-2.585a2 2 0 0 0 -3.414 -1.414z"/>',
  scroll: '<path d="M14 2a5 5 0 0 1 5 5v10a5 5 0 0 1 -5 5h-4a5 5 0 0 1 -5 -5v-10a5 5 0 0 1 5 -5zm-2 4a1 1 0 0 0 -1 1v4l.007 .117a1 1 0 0 0 1.993 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z"/>',
  pulse: '<path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-.293 3.953a1 1 0 0 0 -1.414 0l-2.59 2.59l-.083 .094l-.068 .1a2.001 2.001 0 0 0 -2.547 1.774l-.005 .149l.005 .15a2 2 0 1 0 3.917 -.701a.968 .968 0 0 0 .195 -.152l2.59 -2.59l.083 -.094a1 1 0 0 0 -.083 -1.32zm-4.707 -1.293a6 6 0 0 0 -6 6a1 1 0 0 0 2 0a4 4 0 0 1 4 -4a1 1 0 0 0 0 -2z"/>',
  zap: '<path d="M13 2l.018 .001l.016 .001l.083 .005l.011 .002h.011l.038 .009l.052 .008l.016 .006l.011 .001l.029 .011l.052 .014l.019 .009l.015 .004l.028 .014l.04 .017l.021 .012l.022 .01l.023 .015l.031 .017l.034 .024l.018 .011l.013 .012l.024 .017l.038 .034l.022 .017l.008 .01l.014 .012l.036 .041l.026 .027l.006 .009c.12 .147 .196 .322 .218 .513l.001 .012l.002 .041l.004 .064v6h5a1 1 0 0 1 .868 1.497l-.06 .091l-8 11c-.568 .783 -1.808 .38 -1.808 -.588v-6h-5a1 1 0 0 1 -.868 -1.497l.06 -.091l8 -11l.01 -.013l.018 -.024l.033 -.038l.018 -.022l.009 -.008l.013 -.014l.04 -.036l.028 -.026l.008 -.006a1 1 0 0 1 .402 -.199l.011 -.001l.027 -.005l.074 -.013l.011 -.001l.041 -.002z"/>',
  bug: '<path d="M12 4a4 4 0 0 1 3.995 3.8l.005 .2a1 1 0 0 1 .428 .096l3.033 -1.938a1 1 0 1 1 1.078 1.684l-3.015 1.931a7.17 7.17 0 0 1 .476 2.227h3a1 1 0 0 1 0 2h-3v1a6.01 6.01 0 0 1 -.195 1.525l2.708 1.616a1 1 0 1 1 -1.026 1.718l-2.514 -1.501a6.002 6.002 0 0 1 -3.973 2.56v-5.918a1 1 0 0 0 -2 0v5.917a6.002 6.002 0 0 1 -3.973 -2.56l-2.514 1.503a1 1 0 1 1 -1.026 -1.718l2.708 -1.616a6.01 6.01 0 0 1 -.195 -1.526v-1h-3a1 1 0 0 1 0 -2h3.001v-.055a7 7 0 0 1 .474 -2.173l-3.014 -1.93a1 1 0 1 1 1.078 -1.684l3.032 1.939l.024 -.012l.068 -.027l.019 -.005l.016 -.006l.032 -.008l.04 -.013l.034 -.007l.034 -.004l.045 -.008l.015 -.001l.015 -.002l.087 -.004a4 4 0 0 1 4 -4zm0 2a2 2 0 0 0 -2 2h4a2 2 0 0 0 -2 -2z"/>',
  sun: '<path d="M12 19a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z"/><path d="M18.313 16.91l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07z"/><path d="M7.007 16.993a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z"/><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z"/><path d="M21 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z"/><path d="M6.213 4.81l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.217 -1.567l.102 .07z"/><path d="M19.107 4.893a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z"/><path d="M12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z"/><path d="M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z"/>',
  moon: '<path d="M12 1.992a10 10 0 1 0 9.236 13.838c.341 -.82 -.476 -1.644 -1.298 -1.31a6.5 6.5 0 0 1 -6.864 -10.787l.077 -.08c.551 -.63 .113 -1.653 -.758 -1.653h-.266l-.068 -.006l-.06 -.002z"/>',
  sideClose: '<path d="M18 3a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h12zm0 2h-9v14h9a1 1 0 0 0 .993 -.883l.007 -.117v-12a1 1 0 0 0 -.883 -.993l-.117 -.007zm-2.293 4.293a1 1 0 0 1 .083 1.32l-.083 .094l-1.292 1.293l1.292 1.293a1 1 0 0 1 .083 1.32l-.083 .094a1 1 0 0 1 -1.32 .083l-.094 -.083l-2 -2a1 1 0 0 1 -.083 -1.32l.083 -.094l2 -2a1 1 0 0 1 1.414 0z"/>',
  sideOpen: '<path d="M18 3a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h12zm0 2h-9v14h9a1 1 0 0 0 .993 -.883l.007 -.117v-12a1 1 0 0 0 -.883 -.993l-.117 -.007zm-4.387 4.21l.094 .083l2 2a1 1 0 0 1 .083 1.32l-.083 .094l-2 2a1 1 0 0 1 -1.497 -1.32l.083 -.094l1.292 -1.293l-1.292 -1.293a1 1 0 0 1 -.083 -1.32l.083 -.094a1 1 0 0 1 1.32 -.083z"/>',
};
ICON.logout = ICON.exit; // "Sair" usa a seta de logout (outline)
export const icon = (k, cls = '') => (ICON_F[k]
  ? `<svg class="${cls}" data-i="${k}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON_F[k]}</svg>`
  : `<svg class="${cls}" data-i="${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`);
// sol aparece no escuro (vai para o claro), lua no claro; o CSS escolhe qual mostrar
const themeIco = () => `<span class="th-ico">${icon('sun', 'th-sun')}${icon('moon', 'th-moon')}</span>`;
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
  <div class="shell ${store.get('rail', false) ? 'collapsed' : ''}" id="shell">
    <aside class="rail">
      <div class="rail-top"><a class="brand" href="#/overview"><span class="brand-mark"></span><span>Rastro</span></a>
        <button class="rail-tg" id="rail-tg" type="button">${icon('sideClose', 'tg-c')}${icon('sideOpen', 'tg-o')}</button></div>
      <nav class="nav">${NAV.map(([k, l]) => (k === '#' ? `<div class="lbl-sec"><span>${l}</span></div>` : `<a href="#/${k}" data-k="${k}" data-l="${l}">${icon(k)}<span>${l}</span></a>`)).join('')}</nav>
      <div class="rail-foot"><button id="theme" aria-label="Alternar tema claro/escuro">${themeIco()}<span class="th-to-light">Claro</span><span class="th-to-dark">Escuro</span></button><button id="out" data-l="Sair">${icon('logout')}<span>Sair</span></button></div>
    </aside>
    <div class="main">
      <header class="appbar"><a class="brand" href="#/overview"><span class="brand-mark"></span><span>Rastro</span></a><span class="appbar-t" id="appbar-t"></span><button class="ico-btn" id="m-theme" aria-label="Alternar tema claro/escuro">${themeIco()}</button></header>
      <div class="topbar" id="topbar"></div>
      <main class="content" id="view"></main>
    </div>
    <nav class="tabbar" aria-label="Navegação">${TABS.map(([k, l]) => `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`).join('')}<button id="m-more" data-k="more">${icon('more')}<span>Mais</span></button></nav>
    <div class="sheet-bg" id="sheet" hidden><div class="sheet" role="dialog" aria-label="Mais opções"><i class="grab"></i>
      ${[['pages', 'Páginas'], ['funnel', 'Funil'], ['settings', 'Sites e instalação']].map(([k, l]) => `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${l}</span></a>`).join('')}
      <button id="s-theme">${themeIco()}<span class="th-to-light">Modo claro</span><span class="th-to-dark">Modo escuro</span></button><button id="s-out">${icon('logout')}<span>Sair</span></button></div></div>
  </div>
  <div class="oc-bg" id="oc" hidden><aside class="oc" role="dialog" aria-modal="true" aria-labelledby="oc-t">
    <header class="oc-h"><div class="oc-ht"><span class="oc-ico" id="oc-ico"></span><h2 id="oc-t"></h2></div><button class="ico-btn oc-x" id="oc-x" aria-label="Fechar">${icon('x')}</button></header>
    <div class="oc-b" id="oc-b"></div></aside></div>`;
  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    store.set('theme', document.documentElement.dataset.theme);
    syncThemeColor();
  };
  const sheet = $('#sheet');
  $('#out').onclick = logout; $('#s-out').onclick = logout;
  $('#theme').onclick = toggleTheme; $('#m-theme').onclick = toggleTheme; $('#s-theme').onclick = () => { toggleTheme(); sheet.hidden = true; };
  $('#m-more').onclick = () => { sheet.hidden = false; };
  const shell = $('#shell'), tg = $('#rail-tg');
  const tgLabel = () => { const c = shell.classList.contains('collapsed'); tg.setAttribute('aria-label', c ? 'Expandir menu' : 'Recolher menu'); tg.title = c ? 'Expandir menu' : 'Recolher menu'; $$('.nav a, #out', shell).forEach((x) => (x.title = c ? x.dataset.l : '')); };
  tgLabel();
  tg.onclick = () => { shell.classList.toggle('collapsed'); store.set('rail', shell.classList.contains('collapsed')); tgLabel(); };
  const oc = $('#oc');
  oc.onclick = (e) => { if (e.target === oc) closeKpi(); };
  $('#oc-x').onclick = closeKpi;
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

// ================================================================ offcanvas do indicador
let ocToken = 0;
function openKpi(key) {
  const oc = $('#oc'), body = $('#oc-b'), info = KPI_INFO[key]; if (!oc || !info) return;
  const my = ++ocToken;
  $('#oc-t').textContent = key === 'conversion' ? (site()?.goal_label || info.t) : info.t;
  $('#oc-ico').innerHTML = icon(KPI_ICO[KPI_KEYS.indexOf(key)]);
  body.innerHTML = '<div class="sk-wrap"><i class="sk sk-panel" style="height:120px"></i><i class="sk sk-panel" style="height:200px"></i><i class="sk sk-panel" style="height:160px"></i></div>';
  body.scrollTop = 0;
  oc.hidden = false; document.documentElement.classList.add('oc-lock');
  requestAnimationFrame(() => requestAnimationFrame(() => oc.classList.add('open')));
  setTimeout(() => $('#oc-x')?.focus(), 50);
  renderKpi(body, () => my === ocToken, key, true).catch((e) => { if (my === ocToken) body.innerHTML = `<div class="err">${esc(e.message)}</div>`; });
}
function closeKpi() {
  const oc = $('#oc'); if (!oc || oc.hidden) return;
  ocToken++; oc.classList.remove('open'); document.documentElement.classList.remove('oc-lock');
  setTimeout(() => { if (!oc.classList.contains('open')) oc.hidden = true; }, 380);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeKpi(); });

// ================================================================ efeito de gradiente no clique
const FX_SEL = '.nav a, .btn, a.kpi, .chip, .seg button, .tabbar a, .tabbar button, .sheet a, .sheet button, .rail-foot button, .ico-btn, .rail-tg, .site-pick button';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isLight = () => document.documentElement.dataset.theme === 'light';
// faíscas só em tons de luz (creme/azul claro); laranja só no clique, como acento
const sparkColors = (click) => (isLight() ? ['#111214', '#e55812', '#8a8c92'] : click ? ['#f5ee9e', '#ffd9a0', '#e55812', '#ffffff'] : ['#f5ee9e', '#ffffff', '#fff8cc']);
// anel fino que se expande do ponto: a "explosão"
function ring(t, x, y, strong) {
  if (REDUCE) return;
  const r = t.getBoundingClientRect(), d = Math.hypot(r.width, r.height) * (strong ? 1.25 : 0.9);
  const el = document.createElement('i'); el.className = 'ring';
  el.style.cssText = `left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px`;
  t.appendChild(el);
  el.animate([{ transform: 'scale(.02)', opacity: strong ? 0.9 : 0.7 }, { transform: 'scale(1)', opacity: 0 }],
    { duration: strong ? 750 : 1000, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => el.remove();
}
// explosãozinha: faíscas saem do ponto e somem (Web Animations, sem custo depois que terminam)
function sparks(t, x, y, n, dist, click = false) {
  if (REDUCE) return;
  const cols = sparkColors(click);
  for (let i = 0; i < n; i++) {
    const sp = document.createElement('i'); sp.className = 'spark';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = dist * (0.55 + Math.random() * 0.6), sz = (click ? 2.5 : 1.8) + Math.random() * (click ? 2.5 : 1.6);
    const col = cols[i % cols.length];
    sp.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${col};box-shadow:0 0 ${sz * 2}px ${col}`;
    t.appendChild(sp);
    sp.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 0.95 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }],
      { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => sp.remove();
  }
}
const local = (t, e) => { const r = t.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest?.(FX_SEL); if (!t || t.contains(e.relatedTarget)) return;
  const [x, y] = local(t, e);
  t.classList.add('fx-j'); t.style.setProperty('--mx', x + 'px'); t.style.setProperty('--my', y + 'px');
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.remove('fx-j')));
  if (!t._sp || performance.now() - t._sp > 700) { t._sp = performance.now(); ring(t, x, y, false); sparks(t, x, y, 5, 22); }
});
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest?.(FX_SEL); if (!t) return;
  const [x, y] = local(t, e);
  t.style.setProperty('--mx', x + 'px'); t.style.setProperty('--my', y + 'px');
  if (t.matches('a.kpi')) { const r = t.getBoundingClientRect(); t.style.setProperty('--ry', ((x / r.width - 0.5) * 7).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((0.5 - y / r.height) * 7).toFixed(2) + 'deg'); }
}, { passive: true });
document.addEventListener('pointerout', (e) => {
  const t = e.target.closest?.('a.kpi'); if (!t || t.contains(e.relatedTarget)) return;
  t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg');
});
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest?.(FX_SEL); if (!t) return;
  const [x, y] = local(t, e);
  t.style.setProperty('--x', x + 'px'); t.style.setProperty('--y', y + 'px');
  t.classList.remove('burst'); void t.offsetWidth; t.classList.add('burst');
  clearTimeout(t._fx); t._fx = setTimeout(() => t.classList.remove('burst'), 800);
  ring(t, x, y, true); sparks(t, x, y, 10, 44, true);
});

// cena (Theatre.js): carrega à parte; se falhar, o painel segue sem o efeito
let cinema = null;
import('./cinema.js').then((m) => { cinema = m; }).catch((e) => console.warn('cena desligada', e));

// ================================================================ troca de filtro ao vivo: números sobem/descem, barras e linhas se ajustam
function snapView(el) {
  const s = { kv: {}, bars: {}, h: {}, paths: {} };
  $$('a.kpi', el).forEach((a) => { s.kv[a.dataset.key] = a.querySelector('.kpi-v')?.firstChild?.textContent?.trim(); });
  const hero = $('.kpi-hero .kpi-v', el); if (hero) s.kv.hero = hero.firstChild?.textContent?.trim();
  $$('.li', el).forEach((li) => { const k = (li.closest('.panel')?.querySelector('h2')?.textContent || '') + '|' + (li.querySelector('.k')?.textContent || ''); s.bars[k] = li.querySelector('.b')?.style.width; });
  $$('.kt i, .mbar-t i', el).forEach((i, n) => { s.h[n] = i.style.height; });
  $$('[data-chart] path', el).forEach((p) => { s.paths[p.getAttribute('class')] = p.getAttribute('d'); });
  return s;
}
const parseNum = (t) => { const m = /^(-?\d[\d.]*(?:,\d+)?)(\D*)$/.exec(t || ''); if (!m) return null; return { n: parseFloat(m[1].replace(/\./g, '').replace(',', '.')), dec: (m[1].split(',')[1] || '').length, suf: m[2] }; };
function tweenText(node, from, to) {
  const a = parseNum(from), b = parseNum(to); if (!a || !b || a.suf !== b.suf) return;
  const t0 = performance.now(), dur = 700, fmt = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: b.dec, maximumFractionDigits: b.dec }) + b.suf;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; node.textContent = fmt(a.n + (b.n - a.n) * e); if (k < 1) requestAnimationFrame(step); else node.textContent = to; };
  node.textContent = from; requestAnimationFrame(step);
}
function animateFrom(el, s) {
  const slide = (v, from, to) => {
    if (!v || from == null || from === to) return;
    const a = parseNum(from), b = parseNum(to);
    v.classList.remove('kv-up', 'kv-down'); void v.offsetWidth;
    v.classList.add(a && b && b.n < a.n ? 'kv-down' : 'kv-up');
    tweenText(v.firstChild, from, to);
  };
  $$('a.kpi', el).forEach((a) => { const v = a.querySelector('.kpi-v'); slide(v, s.kv[a.dataset.key], v?.firstChild?.textContent?.trim()); });
  const hero = $('.kpi-hero .kpi-v', el); if (hero) slide(hero, s.kv.hero, hero.firstChild?.textContent?.trim());
  const grow = (node, prop, from) => { const to = node.style[prop]; node.style.transition = 'none'; node.style[prop] = from; void node.offsetWidth; node.style.transition = ''; node.style[prop] = to; };
  $$('.li', el).forEach((li) => { const b = li.querySelector('.b'); if (!b) return; const k = (li.closest('.panel')?.querySelector('h2')?.textContent || '') + '|' + (li.querySelector('.k')?.textContent || ''); grow(b, 'width', s.bars[k] ?? '0%'); });
  $$('.kt i, .mbar-t i', el).forEach((i, n) => grow(i, 'height', s.h[n] ?? '0%'));
  $$('[data-chart] path', el).forEach((p) => {
    const from = s.paths[p.getAttribute('class')], to = p.getAttribute('d');
    const cmds = (d) => (d || '').replace(/[^MLZ]/g, '');
    if (!from || from === to) return;
    if (cmds(from) !== cmds(to)) { p.classList.add('ln-in'); return; }
    p.style.transition = 'none'; p.style.d = `path("${from}")`; void p.getBoundingClientRect();
    p.style.transition = ''; p.style.d = `path("${to}")`;
  });
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
let routeToken = 0, lastRouteKey = '';
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { view: parts[0] || 'overview', arg: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(qs || '') };
}
export function go(hash) { location.hash = hash; }

// pré-carregamento: blocos no formato da página que vai abrir, com brilho passando
function skeleton(view) {
  const head = '<div class="sk-head"><i class="sk sk-t"></i><i class="sk sk-p"></i></div>';
  if (view === 'overview') return `<div class="sk-wrap">${head}<div class="kpis">${'<i class="sk sk-kpi"></i>'.repeat(10)}</div><i class="sk sk-panel"></i></div>`;
  if (view === 'kpi') return `<div class="sk-wrap">${head}<i class="sk sk-panel" style="height:140px"></i><i class="sk sk-panel"></i></div>`;
  return `<div class="sk-wrap">${head}<i class="sk sk-panel"></i><i class="sk sk-panel" style="height:180px"></i></div>`;
}
function syncThemeColor() {
  const c = document.documentElement.dataset.theme === 'light' ? '#f4f2e8' : '#0a0a0b';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c);
}
function hideSplash() {
  const sp = document.getElementById('splash'); if (!sp || sp.classList.contains('out')) return;
  sp.classList.add('out'); setTimeout(() => sp.remove(), 600);
}
setTimeout(hideSplash, 8000);

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
  closeKpi();
  const key = view + '|' + (arg || '') + '|' + JSON.stringify(q || {});
  const live = key === lastRouteKey && el.children.length && !el.querySelector('.sk-wrap, .err');
  lastRouteKey = key;
  const snap = live ? snapView(el) : null;
  el.classList.toggle('live', !!live);
  if (live) document.body.classList.add('busy'); else el.innerHTML = skeleton(view);
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
    if (snap && alive()) animateFrom(el, snap);
    else if (alive()) cinema?.enter(el);
  } catch (e) {
    if (alive()) el.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    console.error(e);
  } finally {
    if (alive()) document.body.classList.remove('busy');
  }
}
window.addEventListener('hashchange', route);

async function boot() {
  document.documentElement.dataset.theme = store.get('theme', null) || 'dark';
  syncThemeColor();
  if (!S.token) { renderLogin(); hideSplash(); return; }
  renderShell();
  try {
    const { rows } = await api('sites');
    S.sites = rows;
    if (!site()) S.siteId = rows[0]?.id || null;
    store.set('site', S.siteId);
    await loadGroupsCount();
  } catch (e) { if (!S.token) return; }
  await route();
  hideSplash();
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

const convBadge = (r) => `<span class="badge ${LV.conversion(r.conv)}" title="Conversão">${fmtPct(r.conv, 0)} conv.</span>`;
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
    ['Sessões com rage click', fmtPct(k.rage), delta(k.rage, p.rage, true), '3 ou mais cliques rápidos no mesmo ponto'],
    ['Sessões com erro JS', fmtPct(k.errors), delta(k.errors, p.errors, true)],
  ];
  const lvOf = (i) => (LV[KPI_KEYS[i]] ? LV[KPI_KEYS[i]](KPI_KEYS[i] === 'scroll' ? k.scroll : k[KPI_KEYS[i]]) : '');
  el.innerHTML = `
    <div class="page-head"><div><h1>Visão geral</h1><p>${esc(site().name)}: como as pessoas chegam, quanto ficam e onde travam.</p></div>
      <a class="btn" href="#/sessions?frustration=1">${icon('sessions')} Ver sessões com frustração</a></div>
    ${k.sessions ? '' : `<div class="note" style="margin-bottom:16px">Ainda não chegou nenhuma sessão nesse período. Confira se o script está instalado no site em <a href="#/settings">Sites e instalação</a>.</div>`}
    <section class="kpis">${K.map(([l, v, dl, help], i) => { const lv = lvOf(i); return `<a class="kpi ${lv ? 'lv-' + lv : ''}" href="#/kpi/${KPI_KEYS[i]}" data-key="${KPI_KEYS[i]}" ${help ? `title="${esc(help)}"` : ''} aria-label="Detalhar ${esc(l)}"><span class="kpi-ico">${icon(KPI_ICO[i])}</span><div class="kpi-l">${lvDot(lv)}${l}</div><div class="kpi-v">${v}${dl}</div></a>`; }).join('')}</section>
    <section class="panel" style="margin-bottom:16px">
      <div class="panel-head"><h2>Sessões ao longo do tempo</h2><div class="legend"><span><i></i>Sessões</span><span><i class="l3"></i>Converteram</span><span><i class="l2"></i>Com frustração ou erro</span></div></div>
      <div class="only-d">${lineChart(d.series, d.bucket)}</div><div class="only-m">${barChart(d.series, d.bucket)}</div>
    </section>
    <div class="grid g3" style="margin-bottom:16px">
      <section class="panel"><div class="panel-head"><h2>Canais</h2></div>${barList(d.channels, { extra: convBadge })}</section>
      <section class="panel"><div class="panel-head"><h2>Dispositivos</h2></div>${barList(d.devices.map((x) => ({ ...x, k: devName(x.k) })), { extra: convBadge })}</section>
      <section class="panel"><div class="panel-head"><h2>Sites de origem</h2></div>${barList(d.refs)}</section>
    </div>
    <div class="grid g2">
      <section class="panel"><div class="panel-head"><h2>Páginas de entrada</h2><a class="small" href="#/pages">Comparar páginas</a></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Página</th><th class="n">Entradas</th><th class="n">Conversão</th><th class="n">Rejeição</th><th class="n">Duração</th></tr></thead>
        <tbody>${d.landings.map((r) => `<tr class="click" data-page="${esc(r.k)}"><td class="lbl">${esc(r.k)}</td><td class="n">${fmtInt(r.n)}</td><td class="n"><span class="badge ${LV.conversion(r.conv)}">${fmtPct(r.conv, 0)}</span></td><td class="n"><span class="badge ${LV.bounce(r.bounce)}">${fmtPct(r.bounce, 0)}</span></td><td class="n">${fmtDur(r.dur)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem dados</td></tr>'}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Erros de JavaScript mais frequentes</h2></div>
        ${d.errors.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Erro</th><th class="n">Sessões</th><th class="n"></th></tr></thead><tbody>
        ${d.errors.map((r) => `<tr><td><div class="lbl" title="${esc(r.k)}">${esc(r.k)}</div><div class="muted small">${esc(r.path || '')}</div></td><td class="n">${fmtInt(r.sessions)}</td><td class="n"><a class="btn sm" href="#/sessions?errors=1">Ver</a></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="muted small">Nenhum erro registrado no período.</div>'}
      </section>
    </div>`;
  bindChart(el, d.series, d.bucket); bindBars(el);
  $$('a.kpi', el).forEach((a) => (a.onclick = (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openKpi(a.dataset.key); }));
  $$('tr[data-page]', el).forEach((tr) => (tr.onclick = () => go('#/heatmap?page=' + encodeURIComponent(tr.dataset.page))));
}

// ================================================================ níveis: verde = bom, amarelo = atenção, vermelho = crítico
const hiBetter = (g, w) => (v) => (v == null || isNaN(v) ? '' : v >= g ? 'good' : v >= w ? 'warn' : 'bad');
const loBetter = (g, w) => (v) => (v == null || isNaN(v) ? '' : v <= g ? 'good' : v <= w ? 'warn' : 'bad');
// volume (sessões, visitantes, pageviews) não tem meta fixa: compara cada dia com a média do período
const relLv = (avg) => (v) => (!v || !avg ? '' : v >= avg * 0.9 ? 'good' : v >= avg * 0.6 ? 'warn' : 'bad');
const LV = {
  conversion: hiBetter(0.2, 0.08), avg_duration: hiBetter(60000, 20000), bounce: loBetter(0.5, 0.75),
  scroll: hiBetter(50, 25), activity: hiBetter(0.6, 0.35), rage: loBetter(0.02, 0.05), errors: loBetter(0.02, 0.05),
};
const LV_TXT = { good: 'Bom', warn: 'Atenção', bad: 'Crítico' };
const lvDot = (l) => (l ? `<i class="lv-dot ${l}" title="${LV_TXT[l]}"></i>` : '');

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

async function renderKpi(el, alive, key, inDrawer = false) {
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
  const ptsAvg = pts ? pts.reduce((a, x) => a + (x.v || 0), 0) / Math.max(1, pts.filter((x) => x.v).length) : 0;
  const lvPt = LV[key] || relLv(ptsAvg);
  const lvNow = LV[key] ? LV[key](v) : '';
  const trend = () => {
    if (!pts || !pts.length) return '';
    const max = Math.max(1e-9, ...pts.map((x) => x.v || 0));
    const lab = (b) => { const dt = new Date(b); return d.bucket === 'hour' ? dt.getHours() + 'h' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
    return `<section class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>${esc(t)} ao longo do tempo</h2></div>
      <div class="kpi-trend">${pts.map((x) => { const l = lvPt(x.v); return `<div class="kt" title="${lab(x.b)}: ${x.v == null ? '—' : info.fmt(x.v)}${l ? ' · ' + LV_TXT[l] : ''}"><i class="${l}" style="height:${Math.max(2, ((x.v || 0) / max) * 100)}%"></i><span>${lab(x.b)}</span></div>`; }).join('')}</div>
      <div class="legend" style="margin-top:12px"><span><i class="lg-good"></i>Bom</span><span><i class="lg-warn"></i>Atenção</span><span><i class="lg-bad"></i>Crítico</span>${LV[key] ? '' : '<span>comparado à média do período</span>'}</div></section>`;
  };
  if (!inDrawer && $('#appbar-t')) $('#appbar-t').textContent = t;
  const prevTxt = pv == null || isNaN(pv) ? 'sem dados do período anterior' : `período anterior: <b>${info.fmt(pv)}</b>`;
  el.innerHTML = `
    ${inDrawer ? '' : `<div class="page-head"><div><a class="small" href="#/overview">← Visão geral</a><h1>${esc(t)}</h1><p>${esc(site().name)}: o que este número significa e como melhorar.</p></div>
      ${info.link ? `<a class="btn" href="${info.link[0]}">${esc(info.link[1])}</a>` : ''}</div>`}
    <section class="kpi-hero panel ${lvNow ? 'lv-' + lvNow : ''}" style="margin-bottom:16px">
      <div class="kpi-v">${v == null || isNaN(v) ? '—' : info.fmt(v)} ${delta(v, pv, !!info.invert)}</div>
      <div class="muted">${prevTxt}${lvNow ? ` · <span class="lv-txt ${lvNow}">${lvDot(lvNow)}${LV_TXT[lvNow]}</span>` : ''}</div>
      ${inDrawer && info.link ? `<a class="btn sm" href="${info.link[0]}">${esc(info.link[1])}</a>` : ''}
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
