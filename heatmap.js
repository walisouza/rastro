// Rastro — mapa de calor (cliques, movimento, scroll, zonas e frustração) sobre a página gravada
import { S, api, baseParams, esc, fmtInt, fmtPct, fmtDur, showTip, hideTip, go, $, $$, icon, devName, fmtDate } from './app.js';
import { loadEvents } from './chunks.js';

const MODES = [
  ['click', 'Cliques'], ['move', 'Movimento'], ['scroll', 'Scroll'], ['zones', 'Zonas'], ['frust', 'Frustração'],
];
const METRICS = [
  ['rate', 'Taxa de cliques', 'Parte das views em que o elemento foi clicado'],
  ['clicks', 'Total de cliques', 'Número de cliques no elemento'],
  ['hover', 'Tempo de hover', 'Tempo médio com o mouse sobre o elemento (entre quem passou o mouse)'],
  ['exposure', 'Exposição', 'Parte das views que rolaram a página até o elemento'],
  ['attract', 'Atratividade', 'Entre quem viu o elemento, quantos clicaram'],
];
const lsGet = (k, d) => { try { return localStorage.getItem('rastro_' + k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('rastro_' + k, v); } catch {} };

// ---------------------------------------------------------------- paleta térmica
const PAL = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0);
  [[0, '#2b4bd8'], [0.3, '#21c3d6'], [0.52, '#3fd36b'], [0.74, '#ffd23f'], [1, '#ff3b2f']].forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 1);
  return g.getImageData(0, 0, 256, 1).data;
})();
const palRGB = (n) => { const i = Math.max(0, Math.min(255, Math.round(n * 255))) * 4; return [PAL[i], PAL[i + 1], PAL[i + 2]]; };
const palCss = (n, a = 1) => { const [r, g, b] = palRGB(n); return `rgba(${r},${g},${b},${a})`; };

// mesmo algoritmo de seletor do script de captura
function selOf(el, doc) {
  const parts = [];
  while (el && el.nodeType === 1 && el !== doc.documentElement) {
    if (el === doc.body) { parts.unshift('body'); break; }
    const id = el.id;
    if (id && /^[A-Za-z][\w-]{0,60}$/.test(id) && !/\d{4,}/.test(id)) { parts.unshift('#' + id); break; }
    const tag = el.tagName.toLowerCase(); let i = 1, s = el;
    while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
    parts.unshift(tag + ':nth-of-type(' + i + ')');
    el = el.parentElement;
  }
  return parts.join('>');
}

// ---------------------------------------------------------------- densidade -> imagem
const DS = 2; // resolução da grade (px de página por célula)
function heatImage(pts, W, H, radius, gamma = 0.75) {
  const gw = Math.max(1, Math.ceil(W / DS)), gh = Math.max(1, Math.ceil(H / DS));
  const grid = new Float32Array(gw * gh);
  const r = Math.max(2, Math.round(radius / DS)), size = 2 * r + 1;
  const k = new Float32Array(size * size);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = (x * x + y * y) / (r * r);
    k[(y + r) * size + (x + r)] = d >= 1 ? 0 : (1 - d) * (1 - d);
  }
  for (const [px, py, w] of pts) {
    const cx = Math.round(px / DS), cy = Math.round(py / DS);
    if (cx < -r || cy < -r || cx > gw + r || cy > gh + r) continue;
    const y0 = Math.max(0, cy - r), y1 = Math.min(gh - 1, cy + r), x0 = Math.max(0, cx - r), x1 = Math.min(gw - 1, cx + r);
    for (let y = y0; y <= y1; y++) {
      const ko = (y - cy + r) * size - cx + r, go = y * gw;
      for (let x = x0; x <= x1; x++) grid[go + x] += k[ko + x] * w;
    }
  }
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  if (!max) return c;
  const ctx = c.getContext('2d'), img = ctx.createImageData(gw, gh), d = img.data;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i]; if (!v) continue;
    const n = Math.pow(v / max, gamma), j = Math.min(255, Math.round(n * 255)) * 4, o = i * 4;
    d[o] = PAL[j]; d[o + 1] = PAL[j + 1]; d[o + 2] = PAL[j + 2];
    d[o + 3] = Math.min(230, 40 + n * 240) * Math.min(1, n * 12);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- view
export async function renderHeatmap(el, alive, q) {
  const params = baseParams();
  const { rows: labels } = await api('labels', params);
  if (!alive()) return;
  const page = q.get('page') || labels[0]?.label;
  if (!page) {
    el.innerHTML = `<div class="page-head"><div><h1>Mapa de calor</h1></div></div><section class="panel empty"><h2>Sem páginas no período</h2>Quando o site receber visitas, escolha uma página aqui para ver onde as pessoas clicam, rolam e travam.</section>`;
    return;
  }
  let mode = q.get('mode') || lsGet('hm_mode', 'click');
  let metric = lsGet('hm_metric', 'rate');
  let device = q.get('device') || S.device || 'desktop';
  const setQ = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); history.replaceState(null, '', '#/heatmap?' + p); q = p; };

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Mapa de calor</h1><p>Onde as pessoas clicam, até onde rolam e quais elementos chamam atenção.</p></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input class="inp" id="hm-page" list="hm-pages" value="${esc(page)}" style="width:min(360px,70vw)" aria-label="Página">
        <datalist id="hm-pages">${labels.map((l) => `<option value="${esc(l.label)}">${fmtInt(l.n)} views</option>`).join('')}</datalist>
        <a class="btn" href="#/sessions?page=${encodeURIComponent(page)}&replay=1">${icon('sessions')} Sessões desta página</a>
      </div>
    </div>
    <div class="hm-tools">
      <div class="seg" id="hm-mode">${MODES.map(([k, l]) => `<button data-v="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" id="hm-dev">${['desktop', 'tablet', 'mobile'].map((k) => `<button data-v="${k}" class="${k === device ? 'on' : ''}">${devName(k)}</button>`).join('')}</div>
      <select class="sel" id="hm-metric" ${mode === 'zones' ? '' : 'hidden'} aria-label="Métrica das zonas">${METRICS.map(([k, l, h]) => `<option value="${k}" title="${esc(h)}" ${k === metric ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="sel" id="hm-snap" hidden aria-label="Gravação usada como fundo"></select>
    </div>
    <div class="hm-layout">
      <div class="stage-wrap" id="stage-wrap"><div class="loading"><span class="spin"></span> Carregando a página gravada…</div></div>
      <aside class="hm-side" id="hm-side"></aside>
    </div>`;

  $('#hm-page').onchange = (e) => { if (e.target.value) go('#/heatmap?page=' + encodeURIComponent(e.target.value) + '&mode=' + mode); };
  $$('#hm-mode button').forEach((b) => (b.onclick = () => {
    mode = b.dataset.v; lsSet('hm_mode', mode); setQ('mode', mode);
    $$('#hm-mode button').forEach((x) => x.classList.toggle('on', x === b));
    $('#hm-metric').hidden = mode !== 'zones';
    view && view.draw();
  }));
  $('#hm-metric').onchange = (e) => { metric = e.target.value; lsSet('hm_metric', metric); view && view.draw(); };
  $$('#hm-dev button').forEach((b) => (b.onclick = () => { setQ('device', b.dataset.v); go('#/heatmap?' + q); }));

  const data = await api('heatmap', { ...params, device, page });
  if (!alive()) return;
  const sm = data.summary || {};
  if (!sm.pageviews) {
    $('#stage-wrap').innerHTML = `<div class="empty"><h2>Sem views em ${devName(device).toLowerCase()}</h2>Essa página não teve visitas nesse dispositivo e período. Tente outro dispositivo ou um período maior.</div>`;
    $('#hm-side').innerHTML = '';
    return;
  }

  // escolhe a gravação com largura mais próxima da mediana
  const snaps = (data.snaps || []).slice().sort((a, b) => Math.abs(a.vw - sm.vw) - Math.abs(b.vw - sm.vw));
  const snapSel = $('#hm-snap');
  if (snaps.length > 1) {
    snapSel.hidden = false;
    snapSel.innerHTML = snaps.map((s, i) => `<option value="${i}">Fundo: gravação de ${fmtDate(s.ts).toLowerCase()} (${s.vw}px)</option>`).join('');
  }
  let view = null;
  const mount = async (snap) => {
    if (view) view.destroy();
    $('#stage-wrap').innerHTML = '<div class="loading"><span class="spin"></span> Carregando a página gravada…</div>';
    view = await buildView(snap);
    if (alive()) view.draw();
  };
  snapSel.onchange = () => mount(snaps[+snapSel.value]);

  // ------------------------------------------------------------ montagem do palco
  async function buildView(snap) {
    let events = null;
    if (snap) {
      try {
        const { chunks } = await api('snapshot', { pv: snap.pv });
        events = await loadEvents(chunks);
        if (!events.some((e) => e.type === 2)) events = null;
      } catch (e) { console.warn(e); events = null; }
    }
    const wrap = $('#stage-wrap');
    const meta = events?.find((e) => e.type === 4)?.data;
    const vw = meta?.width || snap?.vw || sm.vw || 1440;
    const vh = meta?.height || snap?.vh || sm.vh || 900;
    wrap.innerHTML = `
      <div class="stage-info"><span id="st-info"></span><span id="st-pos"></span></div>
      <div class="stage" id="stage"><div class="stage-inner" id="st-inner">
        <div class="stage-frame" id="st-frame"></div>
        <div class="stage-dim" id="st-dim"></div>
        <div class="stage-layer" id="st-layer"><canvas id="st-canvas"></canvas><div id="st-zones"></div></div>
        <div class="stage-hit" id="st-hit" tabindex="0" aria-label="Página com mapa de calor. Use a roda do mouse ou as setas para rolar."></div>
      </div><div class="minimap" id="st-mini"><i></i></div></div>`;
    const stage = $('#stage'), inner = $('#st-inner'), frame = $('#st-frame'), layer = $('#st-layer'), canvas = $('#st-canvas');
    const zonesEl = $('#st-zones'), hit = $('#st-hit'), dim = $('#st-dim'), mini = $('#st-mini');
    inner.style.width = vw + 'px'; inner.style.height = vh + 'px';

    let rep = null, win = null, doc = null;
    if (events) {
      try {
        rep = new window.RV.Replayer(events, {
          root: frame, mouseTail: false, showWarning: false, showDebug: false, triggerFocus: false,
          pauseAnimation: true, skipInactive: false, UNSAFE_replayCanvas: false,
          insertStyleRules: ['html, body { scroll-behavior: auto !important; }', '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }'],
        });
        const total = events[events.length - 1].timestamp - events[0].timestamp;
        rep.pause(total);
        await new Promise((r) => setTimeout(r, 120));
        const iframe = rep.iframe;
        iframe.style.width = vw + 'px'; iframe.style.height = vh + 'px';
        iframe.setAttribute('width', vw); iframe.setAttribute('height', vh);
        win = iframe.contentWindow; doc = iframe.contentDocument;
        // aguarda imagens e fontes assentarem
        await new Promise((r) => setTimeout(r, 700));
        try { await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 1200))]); } catch {}
        win.scrollTo(0, 0);
      } catch (e) { console.warn('replayer', e); rep = null; win = null; doc = null; frame.innerHTML = ''; }
    }
    let docH = doc ? Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0, vh) : Math.max(sm.doc_h || 0, vh);
    docH = Math.min(docH, 30000);
    if (!doc) {
      const blank = document.createElement('div');
      blank.className = 'stage-blank'; blank.style.height = docH + 'px';
      layer.prepend(blank);
    }
    layer.style.width = vw + 'px'; layer.style.height = docH + 'px';
    $('#st-info').innerHTML = doc
      ? `Página gravada em ${fmtDate(snap.ts).toLowerCase()}, ${vw}×${vh}px. Role sobre a página para navegar.`
      : `<span class="badge warn">Sem gravação desta página</span> Mostrando os dados sobre uma grade neutra (${vw}px de largura). Ative a gravação de sessões para ver a página real.`;

    // escala para caber
    let scale = 1;
    const fit = () => {
      const avail = wrap.clientWidth - 28 - 14;
      scale = Math.min(1, avail / vw);
      inner.style.transform = `scale(${scale})`;
      inner.style.setProperty('--inv', String(1 / scale));
      stage.style.width = vw * scale + 'px'; stage.style.height = vh * scale + 'px';
      mini.style.height = vh * scale + 'px';
      $('i', mini).style.height = Math.max(12, (vh / docH) * vh * scale) + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);

    // rolagem
    let sy = 0;
    const maxY = Math.max(0, docH - vh);
    const scrollTo = (y) => {
      sy = Math.max(0, Math.min(maxY, y));
      if (win) { win.scrollTo(0, sy); sy = win.scrollY; }
      layer.style.transform = `translateY(${-sy}px)`;
      const th = Math.max(12, (vh / docH) * vh * scale);
      $('i', mini).style.top = (maxY ? (sy / maxY) * (vh * scale - th) : 0) + 'px';
      $('#st-pos').textContent = docH > vh ? `${Math.round(((sy + vh) / docH) * 100)}% da página` : '';
    };
    scrollTo(0);
    hit.addEventListener('wheel', (e) => { e.preventDefault(); scrollTo(sy + e.deltaY / scale); hideTip(); }, { passive: false });
    hit.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 80, ArrowUp: -80, PageDown: vh * 0.9, PageUp: -vh * 0.9, Home: -1e9, End: 1e9, ' ': vh * 0.9 }[e.key];
      if (step) { e.preventDefault(); scrollTo(sy + step); }
    });
    let drag = null;
    hit.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { drag = { y: e.clientY, sy }; hit.setPointerCapture(e.pointerId); } });
    hit.addEventListener('pointermove', (e) => { if (drag) scrollTo(drag.sy - (e.clientY - drag.y) / scale); });
    hit.addEventListener('pointerup', () => { drag = null; });
    mini.addEventListener('click', (e) => { const r = mini.getBoundingClientRect(); scrollTo(((e.clientY - r.top) / r.height) * docH - vh / 2); });

    // posição dos elementos na página gravada
    const rectCache = new Map();
    const elRect = (sel) => {
      if (!doc || !sel) return null;
      if (rectCache.has(sel)) return rectCache.get(sel);
      let r = null;
      try {
        const node = doc.querySelector(sel);
        if (node) { const b = node.getBoundingClientRect(); if (b.width > 0 && b.height > 0) r = { x: b.left + win.scrollX, y: b.top + win.scrollY, w: b.width, h: b.height }; }
      } catch {}
      rectCache.set(sel, r);
      return r;
    };
    if (win) win.scrollTo(0, 0);
    const place = (sel, ox, oy, x, y, w) => {
      const r = elRect(sel);
      if (r) return [r.x + (ox || 0) * r.w, r.y + (oy || 0) * r.h];
      return [x * (vw / (w || vw)), y];
    };

    // ---------------------------------------------------------- dados derivados
    const pvN = sm.pageviews;
    const reach = (data.reach || []).slice().sort((a, b) => a - b);
    const expAt = (y) => { // parte das views que viram o pixel y
      if (!reach.length) return null;
      const pct = (y / docH) * 100;
      let lo = 0, hi = reach.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (reach[m] < pct) lo = m + 1; else hi = m; }
      return (reach.length - lo) / reach.length;
    };
    const clickPts = data.clicks.map((c) => [...place(c.sel, c.ox, c.oy, c.x, c.y, c.w), 1]);
    const movePts = data.moves.map((m) => [m.x * (vw / (m.w || vw)), m.y, m.v]);
    const frustPts = data.frust.map((f) => ({ ...f, p: place(f.sel, f.ox, f.oy, f.x, f.y, f.w) }));

    const zmap = new Map();
    const Z = (sel) => { if (!zmap.has(sel)) zmap.set(sel, { sel, txt: '', clicks: 0, cpv: 0, hms: 0, hpv: 0, rage: 0, dead: 0 }); return zmap.get(sel); };
    for (const z of data.zones) Object.assign(Z(z.sel), { txt: z.txt, clicks: z.clicks, cpv: z.pv });
    for (const h of data.hovers) { const z = Z(h.sel); z.hms = +h.ms; z.hpv = h.pv; z.txt = z.txt || h.txt; }
    for (const f of data.frust) { if (!f.sel) continue; const z = Z(f.sel); z[f.type]++; z.txt = z.txt || f.txt; }
    if (doc) {
      let n = 0;
      for (const node of doc.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button]')) {
        if (n++ > 400) break;
        const target = node.closest('a,button,[role=button],[role=link],label,summary') || node;
        const s = selOf(target, doc);
        if (!zmap.has(s)) { const z = Z(s); z.txt = (target.getAttribute('aria-label') || target.innerText || target.getAttribute('placeholder') || target.tagName.toLowerCase()).replace(/\s+/g, ' ').trim().slice(0, 80); z.empty = true; }
      }
    }
    const zones = [...zmap.values()].map((z) => {
      const r = elRect(z.sel);
      const exposure = r ? expAt(r.y + Math.min(r.h / 2, vh / 2)) : null;
      const rate = pvN ? z.cpv / pvN : 0;
      return { ...z, r, rate, exposure, hover: z.hpv ? z.hms / z.hpv : 0, attract: exposure ? Math.min(1, rate / exposure) : 0 };
    });
    // diferencia elementos com o mesmo texto (ex.: vários "Comprar")
    const byTxt = new Map();
    zones.filter((z) => z.r).sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x).forEach((z) => { const k = z.txt; byTxt.set(k, (byTxt.get(k) || 0) + 1); z.nth = byTxt.get(k); });
    zones.forEach((z) => { if ((byTxt.get(z.txt) || 0) > 1) z.txt = `${z.txt} (${z.nth}º)`; });
    const fmtMetric = (z, m = metric) => m === 'rate' ? fmtPct(z.rate) : m === 'clicks' ? fmtInt(z.clicks) : m === 'hover' ? (z.hover ? (z.hover / 1000).toFixed(1).replace('.', ',') + 's' : '0s') : m === 'exposure' ? fmtPct(z.exposure, 0) : fmtPct(z.attract);
    const zoneTip = (z) => `<b>${esc(z.txt || 'Elemento')}</b>
      <div class="tr"><span>Cliques</span><span>${fmtInt(z.clicks)}</span></div>
      <div class="tr"><span>Taxa de cliques</span><span>${fmtPct(z.rate)}</span></div>
      <div class="tr"><span>Exposição</span><span>${z.exposure == null ? '—' : fmtPct(z.exposure, 0)}</span></div>
      <div class="tr"><span>Atratividade</span><span>${fmtPct(z.attract)}</span></div>
      <div class="tr"><span>Tempo de hover</span><span>${fmtMetric(z, 'hover')}</span></div>
      ${z.rage || z.dead ? `<div class="tr"><span>Rage / sem resposta</span><span>${z.rage} / ${z.dead}</span></div>` : ''}`;

    // ---------------------------------------------------------- desenho
    let drawnZones = [];
    function draw() {
      zonesEl.innerHTML = ''; drawnZones = [];
      const ctx = canvas.getContext('2d');
      const setCanvas = (c) => {
        canvas.width = c ? c.width : Math.ceil(vw / DS); canvas.height = c ? c.height : Math.ceil(docH / DS);
        canvas.style.width = vw + 'px'; canvas.style.height = docH + 'px';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (c) ctx.drawImage(c, 0, 0);
      };
      dim.style.opacity = mode === 'scroll' ? 0 : mode === 'zones' ? 0.45 : 1;
      if (mode === 'click') setCanvas(heatImage(clickPts, vw, docH, 26));
      else if (mode === 'move') setCanvas(heatImage(movePts, vw, docH, 36, 0.6));
      else if (mode === 'scroll') {
        setCanvas(null);
        for (let y = 0; y < canvas.height; y++) {
          const e = expAt(y * DS);
          if (e == null) break;
          const [r, g, b] = palRGB(e);
          ctx.fillStyle = `rgba(${r},${g},${b},0.5)`; ctx.fillRect(0, y, canvas.width, 1);
        }
        const marks = [[0.75, '75% dos visitantes viram até aqui'], [0.5, 'Metade viu até aqui'], [0.25, '25% viram até aqui']];
        for (const [p, txt] of marks) {
          let y = null;
          for (let yy = 0; yy < docH; yy += 4) { if (expAt(yy) < p) { y = yy; break; } }
          if (y != null && y > 10) zonesEl.insertAdjacentHTML('beforeend', `<div class="scroll-mark" style="top:${y}px"><span>${txt}</span></div>`);
        }
        zonesEl.insertAdjacentHTML('beforeend', `<div class="scroll-mark fold" style="top:${sm.vh || vh}px"><span>Dobra média (${sm.vh || vh}px)</span></div>`);
      } else if (mode === 'zones') {
        setCanvas(null);
        const vals = zones.filter((z) => z.r).map((z) => ({ z, v: metric === 'exposure' ? z.exposure || 0 : z[metric] || 0 }));
        const max = Math.max(1e-9, ...vals.map((x) => x.v));
        const relative = !['exposure'].includes(metric);
        vals.sort((a, b) => b.z.r.w * b.z.r.h - a.z.r.w * a.z.r.h);
        for (const { z, v } of vals) {
          if (z.r.y > docH || z.r.w < 3 || z.r.h < 3) continue;
          const n = relative ? v / max : v;
          const d = document.createElement('div');
          d.className = 'zone';
          d.style.cssText = `left:${z.r.x}px;top:${z.r.y}px;width:${z.r.w}px;height:${z.r.h}px;background:${v > 0 ? palCss(Math.max(0.05, n), 0.62) : 'rgba(43,75,216,.16)'}`;
          if (v > 0 && z.r.w > 24 && z.r.h > 12) d.innerHTML = `<b>${fmtMetric(z)}</b>`;
          zonesEl.append(d);
          drawnZones.push({ z, d, area: z.r.w * z.r.h });
        }
      } else if (mode === 'frust') {
        setCanvas(null);
        for (const f of frustPts) {
          const [x, y] = f.p;
          ctx.beginPath(); ctx.arc(x / DS, y / DS, 9, 0, Math.PI * 2);
          ctx.fillStyle = f.type === 'rage' ? 'rgba(229,72,77,.85)' : 'rgba(242,169,59,.85)'; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
      }
      renderSide();
    }

    // ---------------------------------------------------------- tooltip
    const zoneAt = (x, y) => {
      let best = null;
      for (const z of zones) {
        const r = z.r; if (!r) continue;
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && (!best || r.w * r.h < best.r.w * best.r.h)) best = z;
      }
      return best;
    };
    let raf = 0;
    hit.addEventListener('mousemove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hit.getBoundingClientRect();
        const x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale + sy;
        $$('.zone.hl', zonesEl).forEach((d) => d.classList.remove('hl'));
        if (mode === 'scroll') {
          const ex = expAt(y);
          return ex == null ? hideTip() : showTip(`<b>${fmtPct(ex, 0)}</b> das views chegaram até aqui`, e.clientX, e.clientY);
        }
        const z = zoneAt(x, y);
        if (!z) return hideTip();
        if (mode === 'zones') { const dz = drawnZones.find((d) => d.z === z); if (dz) dz.d.classList.add('hl'); }
        showTip(zoneTip(z), e.clientX, e.clientY);
      });
    });
    hit.addEventListener('mouseleave', hideTip);

    // ---------------------------------------------------------- painel lateral
    const focusZone = (z) => {
      if (!z.r) return;
      scrollTo(z.r.y - vh / 3);
      const ring = document.createElement('div');
      ring.className = 'zone hl';
      ring.style.cssText = `left:${z.r.x - 4}px;top:${z.r.y - 4}px;width:${z.r.w + 8}px;height:${z.r.h + 8}px;background:transparent;outline:3px solid #ffd23f`;
      zonesEl.append(ring); setTimeout(() => ring.remove(), 1600);
    };
    function renderSide() {
      const side = $('#hm-side');
      const avgReach = reach.length ? reach.reduce((a, b) => a + b, 0) / reach.length : null;
      let list = '', title = '', legend = '';
      if (mode === 'click' || mode === 'move' || mode === 'zones') {
        const key = mode === 'move' ? 'hover' : mode === 'zones' ? metric : 'clicks';
        const top = zones.filter((z) => (key === 'exposure' ? z.r && z.exposure != null : (z[key] || 0) > 0)).sort((a, b) => (key === 'exposure' ? b.exposure - a.exposure : b[key] - a[key])).slice(0, 15);
        title = mode === 'move' ? 'Elementos com mais hover' : mode === 'zones' ? 'Elementos por ' + METRICS.find((m) => m[0] === metric)[1].toLowerCase() : 'Elementos mais clicados';
        const maxV = Math.max(1e-9, ...top.map((z) => (key === 'exposure' ? z.exposure : z[key])));
        list = top.length ? `<div class="list zone-list">${top.map((z, i) => `<div class="li" data-i="${zones.indexOf(z)}" title="${esc(z.txt)}"><i class="b" style="width:calc(${((key === 'exposure' ? z.exposure : z[key]) / maxV) * 100}% + 6px)"></i><span class="k">${esc(z.txt || z.sel)}${z.r ? '' : ' <span class="muted small">(fora desta versão)</span>'}</span><span class="v">${fmtMetric(z, key)}</span></div>`).join('')}</div>`
          : '<div class="muted small">Ainda não há dados de elementos.</div>';
        legend = `<div class="scale"></div><div class="scale-l"><span>Menos</span><span>Mais</span></div>`;
      } else if (mode === 'scroll') {
        title = 'Até onde as pessoas rolam';
        const at = (p) => { const n = reach.filter((r) => r >= p).length; return reach.length ? n / reach.length : 0; };
        list = `<div class="list">${[25, 50, 75, 100].map((p) => `<div class="li"><i class="b" style="width:calc(${at(p) * 100}% + 6px)"></i><span class="k">Viram ${p}% da página</span><span class="v">${fmtPct(at(p), 0)}</span></div>`).join('')}</div>`;
        legend = `<div class="scale"></div><div class="scale-l"><span>Poucos viram</span><span>Todos viram</span></div>`;
      } else {
        title = 'Pontos de frustração';
        const g = new Map();
        for (const f of data.frust) { const k = f.type + '|' + (f.txt || f.sel); const x = g.get(k) || { type: f.type, txt: f.txt || f.sel, n: 0, sel: f.sel }; x.n++; g.set(k, x); }
        const top = [...g.values()].sort((a, b) => b.n - a.n).slice(0, 15);
        list = top.length ? `<div class="list zone-list">${top.map((x) => `<div class="li" data-sel="${esc(x.sel || '')}"><span class="k"><span class="badge ${x.type === 'rage' ? 'bad' : 'warn'}">${x.type === 'rage' ? 'rage' : 'sem resposta'}</span> ${esc(x.txt || '')}</span><span class="v">${fmtInt(x.n)}</span></div>`).join('')}</div>`
          : '<div class="muted small">Nenhum rage click nem clique sem resposta nesta página. Bom sinal.</div>';
        legend = `<div class="legend"><span><i style="background:#e5484d;height:8px;width:8px;border-radius:50%"></i>Rage click</span><span><i style="background:#f2a93b;height:8px;width:8px;border-radius:50%"></i>Clique sem resposta</span></div>`;
      }
      side.innerHTML = `
        <section class="panel">
          <div class="stat-row">
            <div><div class="v num">${fmtInt(sm.pageviews)}</div><div class="l">Views</div></div>
            <div><div class="v num">${(sm.clicks || 0).toFixed(1).replace('.', ',')}</div><div class="l">Cliques por view</div></div>
            <div><div class="v num">${fmtDur(sm.avg_time)}</div><div class="l">Tempo médio</div></div>
            <div><div class="v num">${avgReach == null ? '—' : Math.round(avgReach) + '%'}</div><div class="l">Scroll médio</div></div>
          </div>
        </section>
        <section class="panel"><div class="panel-head"><h2>${title}</h2></div>${list}<div style="margin-top:14px">${legend}</div></section>`;
      $$('.zone-list .li', side).forEach((li) => (li.onclick = () => {
        const z = li.dataset.i ? zones[+li.dataset.i] : zones.find((x) => x.sel === li.dataset.sel);
        if (z) focusZone(z);
      }));
    }

    return { draw, destroy() { ro.disconnect(); try { rep && rep.destroy && rep.destroy(); } catch {} } };
  }

  await mount(snaps[0] || null);
}
