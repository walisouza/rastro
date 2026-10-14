// Rastro — script de captura (heatmaps, scroll, jornada, frustração e session replay)
// Uso: <script src="https://SEU-SITE.netlify.app/t.js" data-key="CHAVE" defer></script>
import { record } from '@rrweb/record';
import { gzipSync, strToU8 } from 'fflate';

(function () {
  if (window.__rastro) return;
  window.__rastro = 1;

  var script = document.currentScript || document.querySelector('script[data-key][src*="/t.js"]');
  if (!script) return;
  var KEY = script.getAttribute('data-key');
  if (!KEY) return;
  // endereço da API: pasta onde está o t.js (Supabase: .../functions/v1/rastro) ou /api no Netlify
  var SRC = new URL(script.src, location.href);
  var API = script.getAttribute('data-api') || (SRC.origin + SRC.pathname.replace(/\/t\.js$/, ''));
  if (API === SRC.origin) API += '/api';
  var UA = navigator.userAgent || '';
  if (/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|phantom/i.test(UA)) return;
  if (script.getAttribute('data-dnt') === 'respect' && (navigator.doNotTrack === '1' || window.doNotTrack === '1')) return;
  if (location.search.indexOf('rastro_off') > -1) return;
  // chave inválida ou domínio não autorizado: para de enviar por 6h (economiza requisições)
  try { var off = +localStorage.getItem('rs_off_' + KEY); if (off && Date.now() - off < 6 * 3600e3) return; } catch (e) {}

  // ---------------------------------------------------------------- utils
  var now = function () { return Date.now(); };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = [].map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function b64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function normPath(p) {
    p = p || '/';
    try { p = decodeURI(p); } catch (e) {}
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }
  function docH() {
    var d = document.documentElement, b = document.body || {};
    return Math.max(d.scrollHeight || 0, b.scrollHeight || 0, d.offsetHeight || 0, b.offsetHeight || 0);
  }

  // ---------------------------------------------------------------- dispositivo
  var W0 = window.innerWidth;
  var dev = /iPad|Tablet|PlayBook|Silk/i.test(UA) || (/Android/i.test(UA) && !/Mobile/i.test(UA)) ||
    (/Macintosh/i.test(UA) && navigator.maxTouchPoints > 1) ? 'tablet'
    : /Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(UA) ? 'mobile'
    : W0 < 768 ? 'mobile' : 'desktop';
  var br = /Edg\//.test(UA) ? 'Edge' : /OPR\/|Opera/.test(UA) ? 'Opera' : /SamsungBrowser/.test(UA) ? 'Samsung'
    : /Instagram/.test(UA) ? 'Instagram' : /FBAN|FBAV/.test(UA) ? 'Facebook' : /Firefox\//.test(UA) ? 'Firefox'
    : /Chrome\//.test(UA) ? 'Chrome' : /Safari\//.test(UA) ? 'Safari' : 'Outro';
  var os = /Windows/.test(UA) ? 'Windows' : /iPhone|iPad|iPod/.test(UA) ? 'iOS' : /Android/.test(UA) ? 'Android'
    : /Mac OS X|Macintosh/.test(UA) ? 'macOS' : /Linux/.test(UA) ? 'Linux' : 'Outro';

  // ---------------------------------------------------------------- visitante e sessão (30 min de inatividade)
  var vid = LS.get('rs_vid'), isNew = !vid;
  if (!vid) { vid = uuid(); LS.set('rs_vid', vid); }
  var sess = null;
  try { sess = JSON.parse(LS.get('rs_sess') || 'null'); } catch (e) {}
  if (!sess || sess.k !== KEY || now() - sess.last > 30 * 60e3) {
    var qs = new URLSearchParams(location.search), ref = document.referrer || '';
    try { if (ref && new URL(ref).hostname === location.hostname) ref = ''; } catch (e) {}
    sess = {
      id: uuid(), k: KEY, ts: now(), last: now(), seq: 0, rp: null, nw: isNew, ref: ref, lp: normPath(location.pathname),
      utm: { s: qs.get('utm_source') || '', m: qs.get('utm_medium') || '', c: qs.get('utm_campaign') || '' },
    };
  }
  function saveSess() { sess.last = now(); LS.set('rs_sess', JSON.stringify(sess)); }

  // ---------------------------------------------------------------- pageview
  var pv;
  function newPageview() {
    sess.seq++;
    saveSess();
    pv = {
      id: uuid(), seq: sess.seq, url: location.href.split('#')[0].slice(0, 2000), path: normPath(location.pathname),
      title: (document.title || '').slice(0, 300), ts: now(), vw: window.innerWidth, vh: window.innerHeight,
      dh: docH(), ms: window.scrollY + window.innerHeight, dur: 0, act: 0, cl: 0, cseq: 0, nerr: 0,
    };
  }
  newPageview();

  // ---------------------------------------------------------------- fila de eventos
  var E = [], R = [], hover = {}, moves = {}, cfg = { rs: 1, mt: false };
  function push(e) { e.pv = pv.id; e.path = pv.path; e.ts = e.ts || now(); if (E.length < 5000) E.push(e); }

  // seletor estável (#id ou cadeia tag:nth-of-type)
  function sel(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      if (el === document.body) { parts.unshift('body'); break; }
      var id = el.id;
      if (id && /^[A-Za-z][\w-]{0,60}$/.test(id) && !/\d{4,}/.test(id)) { parts.unshift('#' + id); break; }
      var tag = el.tagName.toLowerCase(), i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return parts.join('>');
  }
  var ZONE = 'a,button,input,select,textarea,label,summary,img,video,iframe,svg,[role=button],[role=link],[role=tab],[onclick],h1,h2,h3,h4,h5,h6,p,li,[data-rastro-zone]';
  var INTERACTIVE = 'a,button,input,select,textarea,label,summary,video,[role=button],[role=link],[role=tab],[role=menuitem],[onclick],[tabindex]';
  function zoneOf(t) {
    var a = t.closest('a,button,[role=button],[role=link],label,summary');
    if (a) return a;
    var z = t.closest(ZONE) || t;
    if (z.tagName && z.tagName.toLowerCase() === 'svg' && z.parentElement) z = z.parentElement.closest(ZONE) || z;
    return z;
  }
  function label(z) {
    if (cfg.mt) return z.tagName.toLowerCase();
    var tag = z.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return (z.getAttribute('aria-label') || z.getAttribute('placeholder') || z.name || tag.toLowerCase()).slice(0, 80);
    if (tag === 'IMG') return ('img: ' + (z.alt || (z.src || '').split('/').pop())).slice(0, 80);
    var t = z.getAttribute('aria-label') || z.innerText || z.textContent || z.getAttribute('title') || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 80) || tag.toLowerCase();
  }
  function isInteractive(t) {
    if (t.closest(INTERACTIVE)) return true;
    try { return getComputedStyle(t).cursor === 'pointer'; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- atividade, scroll, tempo
  var lastActive = now(), lastMut = 0;
  function active() { lastActive = now(); }
  function onScroll() {
    active();
    var b = window.scrollY + window.innerHeight;
    if (b > pv.ms) pv.ms = b;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  ['keydown', 'touchstart', 'pointerdown'].forEach(function (t) { window.addEventListener(t, active, { passive: true, capture: true }); });
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    pv.dur += 1000;
    if (now() - lastActive < 5000) pv.act += 1000;
    var h = docH(); if (h > pv.dh) pv.dh = h;
  }, 1000);
  try {
    new MutationObserver(function () { lastMut = now(); })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  } catch (e) {}

  // ---------------------------------------------------------------- cliques, rage e dead clicks
  var burst = [];
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    if (!t || !t.closest) return;
    active();
    if (e.detail === 0 && !e.clientX && !e.clientY) return; // teclado
    var z = zoneOf(t), r = z.getBoundingClientRect(), ts = now();
    var ev = {
      t: 'click', ts: ts, x: Math.round(e.pageX), y: Math.round(e.pageY), w: window.innerWidth, sel: sel(z),
      ox: r.width ? +((e.clientX - r.left) / r.width).toFixed(3) : 0, oy: r.height ? +((e.clientY - r.top) / r.height).toFixed(3) : 0,
      txt: label(z),
    };
    // links: guarda o destino (para medir conversão, ex.: botão da ticketeria)
    var link = t.closest('a[href]');
    if (link && link.href && !/^(javascript|mailto|tel):/i.test(link.href)) {
      var out = 0;
      try { out = new URL(link.href, location.href).hostname !== location.hostname ? 1 : 0; } catch (err) {}
      ev.m = { href: link.href.slice(0, 500), out: String(out) };
    }
    push(ev);
    if (ev.m && ev.m.out === '1') setTimeout(function () { flush(true, true); }, 0); // saindo do site: envia já
    pv.cl++;
    // rage: 3+ cliques em 1s num raio de 30px
    burst = burst.filter(function (b) { return ts - b.ts < 1000 && Math.abs(b.x - ev.x) < 30 && Math.abs(b.y - ev.y) < 30; });
    burst.push(ev);
    if (burst.length === 3) push({ t: 'rage', ts: ts, x: ev.x, y: ev.y, w: ev.w, sel: ev.sel, ox: ev.ox, oy: ev.oy, txt: ev.txt, v: 3 });
    // dead: clique em elemento não interativo sem nenhuma reação em 1s
    if (!isInteractive(t)) {
      var href = location.href, sy = window.scrollY;
      setTimeout(function () {
        if (lastMut < ts && location.href === href && window.scrollY === sy)
          push({ t: 'dead', ts: ts, x: ev.x, y: ev.y, w: ev.w, sel: ev.sel, ox: ev.ox, oy: ev.oy, txt: ev.txt });
      }, 1000);
    }
  }, true);

  // ---------------------------------------------------------------- movimento e hover (desktop)
  var curZone = null, curSel = null, curTxt = '', enter = 0, lastMove = 0;
  function closeHover(ts) {
    if (curSel && enter) {
      var d = Math.min(ts - enter, 30000);
      if (d >= 150) { var h = hover[curSel] || (hover[curSel] = { v: 0, txt: curTxt }); h.v += d; }
    }
    curZone = curSel = null; enter = 0;
  }
  document.addEventListener('mousemove', function (e) {
    var ts = now();
    if (ts - lastMove < 100) return;
    lastMove = ts; active();
    var k = Math.round(e.pageX / 24) + ':' + Math.round(e.pageY / 24);
    moves[k] = (moves[k] || 0) + 1;
    var t = e.target && e.target.nodeType === 1 ? e.target : null;
    var z = t && t.closest ? zoneOf(t) : null;
    if (z !== curZone) {
      closeHover(ts);
      if (z && z !== document.body) { curZone = z; curSel = sel(z); curTxt = label(z); enter = ts; }
    }
  }, { passive: true });
  document.addEventListener('mouseleave', function () { closeHover(now()); });

  // ---------------------------------------------------------------- erros
  window.addEventListener('error', function (e) {
    if (pv.nerr++ > 20) return;
    if (e.target && e.target !== window && e.target.tagName) {
      var src = e.target.src || e.target.href || '';
      if (src) push({ t: 'error', txt: ('Falha ao carregar ' + e.target.tagName.toLowerCase() + ': ' + src).slice(0, 300), m: { kind: 'resource' } });
      return;
    }
    push({ t: 'error', txt: String(e.message || 'Erro').slice(0, 300), m: { src: (e.filename || '').slice(0, 300), l: e.lineno, c: e.colno } });
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    if (pv.nerr++ > 20) return;
    var r = e.reason;
    push({ t: 'error', txt: ('Promise: ' + (r && r.message ? r.message : String(r))).slice(0, 300), m: { kind: 'promise' } });
  });

  // ---------------------------------------------------------------- envio
  function sessPayload() {
    return {
      id: sess.id, vid: vid, new: sess.nw, ts: sess.ts, now: now(), dev: dev, br: br, os: os,
      lang: navigator.language, tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone,
      sw: screen.width, sh: screen.height, ref: sess.ref, utm: sess.utm, lp: sess.lp,
    };
  }
  function pvPayload(p) {
    return { id: p.id, seq: p.seq, url: p.url, path: p.path, title: p.title, ts: p.ts, vw: p.vw, vh: p.vh, dh: p.dh, ms: Math.round(p.ms), dur: p.dur, act: p.act, cl: p.cl };
  }
  function drainAggregates() {
    closeHover(now());
    for (var s in hover) push({ t: 'hover', sel: s, v: hover[s].v, txt: hover[s].txt });
    for (var k in moves) {
      var xy = k.split(':');
      push({ t: 'move', x: +xy[0] * 24, y: +xy[1] * 24, w: window.innerWidth, v: moves[k] });
    }
    hover = {}; moves = {};
  }
  var sending = false, failures = 0, stopped = false;
  function stop() {
    stopped = true;
    LS.set('rs_off_' + KEY, String(Date.now()));
    if (stopRec) { try { stopRec(); } catch (e) {} stopRec = null; }
  }
  function beacon(url, body) {
    if (body.length >= 60000) return false;
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return true; } catch (err) {}
    try { fetch(url, { method: 'POST', body: body, headers: { 'content-type': 'text/plain' }, keepalive: true, credentials: 'omit' }); return true; } catch (err) {}
    return false;
  }
  function flush(final, eventsOnly) {
    if (sending && !final) return;
    drainAggregates();
    var e = E.splice(0), r = eventsOnly ? [] : R.splice(0), chunks = [];
    if (r.length) {
      var u8 = gzipSync(strToU8(JSON.stringify(r)), { level: 6 });
      var snap = r.some(function (x) { return x.type === 2; });
      chunks.push({ pv: pv.id, seq: pv.cseq++, ts: r[0].timestamp, snap: snap, enc: 'gz', d: b64(u8) });
    }
    if (stopped) return;
    var url = API + '/collect';
    saveSess();
    if (final) {
      // ao sair: primeiro os eventos (pequenos, chegam via beacon), depois a gravação
      var small = JSON.stringify({ k: KEY, s: sessPayload(), p: [pvPayload(pv)], e: e, r: [] });
      beacon(url, small);
      if (!chunks.length) return;
      e = [];
    }
    var body = JSON.stringify({ k: KEY, s: sessPayload(), p: [pvPayload(pv)], e: e, r: chunks });
    if (final && body.length < 60000 && beacon(url, body)) return;
    sending = true;
    fetch(url, { method: 'POST', body: body, headers: { 'content-type': 'text/plain' }, keepalive: body.length < 60000, credentials: 'omit' })
      .then(function (res) {
        failures = res.ok ? 0 : failures + 1;
        if (res.status === 404 || res.status === 403) stop();
      })
      .catch(function () { failures++; if (!final && failures < 3) { E = e.concat(E); R = []; } })
      .then(function () { sending = false; });
  }
  // envia aos 3s (pega o início da gravação) e depois a cada 20s; ao sair da página, envia o restante
  setTimeout(function () { flush(false); }, 3000);
  setInterval(function () { if (failures < 3) flush(false); }, 20000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });

  // ---------------------------------------------------------------- SPA (pushState / popstate)
  function onNav() {
    var p = normPath(location.pathname);
    if (p === pv.path) return;
    flush(false);
    newPageview();
    if (stopRec) { try { record.takeFullSnapshot(true); } catch (e) {} }
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () { var r = orig.apply(this, arguments); setTimeout(onNav, 0); return r; };
  });
  window.addEventListener('popstate', function () { setTimeout(onNav, 0); });

  // ---------------------------------------------------------------- session replay (rrweb)
  var stopRec = null;
  function startReplay() {
    if (sess.rp === null) { sess.rp = Math.random() < cfg.rs; saveSess(); }
    if (!sess.rp || stopRec || stopped) return;
    try {
      stopRec = record({
        emit: function (ev) { if (R.length < 20000) R.push(ev); },
        maskAllInputs: true,
        maskTextClass: 'rastro-mask',
        blockClass: 'rastro-block',
        maskTextSelector: cfg.mt ? '*' : null,
        inlineStylesheet: true,
        recordCanvas: false,
        collectFonts: false,
        slimDOMOptions: 'all',
        sampling: { mousemove: 50, scroll: 150, media: 800, input: 'last' },
      });
    } catch (e) { stopRec = null; }
  }
  var cached = null;
  try { cached = JSON.parse(LS.get('rs_cfg') || 'null'); } catch (e) {}
  if (cached && cached.k === KEY && now() - cached.t < 10 * 60e3) { cfg = cached.c; startReplay(); }
  else {
    fetch(API + '/config?k=' + encodeURIComponent(KEY), { credentials: 'omit' })
      .then(function (r) { if (r.status === 404) { stop(); return null; } return r.ok ? r.json() : null; })
      .then(function (c) { if (c) { cfg = c; LS.set('rs_cfg', JSON.stringify({ k: KEY, t: now(), c: c })); } startReplay(); })
      .catch(function () {});
  }

  window.rastro = { session: function () { return sess.id; }, flush: function () { flush(false); } };
})();
