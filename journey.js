// Rastro — jornada (sankey) e funil
import { S, api, baseParams, esc, fmtInt, fmtPct, showTip, hideTip, go, $, $$, site } from './app.js';

const NODE_COLORS = ['#3b3bd6', '#21a0c9', '#2fb36d', '#d9a400', '#e0612f', '#a14bd1', '#5a6378'];
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem('rastro_' + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('rastro_' + k, JSON.stringify(v)); } catch {} };

// ================================================================ jornada
export async function renderJourney(el, alive, q) {
  const start = q.get('start') || '';
  const depth = +(q.get('depth') || lsGet('jr_depth', 4));
  const topN = +(q.get('top') || 6);
  const [{ rows: labels }, jr] = await Promise.all([
    api('labels', baseParams()),
    api('journey', baseParams({ depth, start })),
  ]);
  if (!alive()) return;
  const total = jr.rows.reduce((a, r) => a + r.n, 0);
  const nav = (k, v) => { const p = new URLSearchParams(q); v === '' ? p.delete(k) : p.set(k, v); go('#/journey?' + p); };

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Jornada</h1><p>${start ? `Caminhos a partir de <b>${esc(start)}</b>.` : 'Os caminhos que as sessões fazem pelo site, da primeira página até a saída.'} Passe o mouse nos fluxos para ver os números.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input class="inp" id="jr-start" list="jr-pages" placeholder="Começar em qualquer página" value="${esc(start)}" style="width:240px" aria-label="Página inicial">
        <datalist id="jr-pages">${labels.map((l) => `<option value="${esc(l.label)}">`).join('')}</datalist>
        ${start ? '<button class="btn ghost" id="jr-clear">Limpar</button>' : ''}
        <select class="sel" id="jr-depth" aria-label="Etapas">${[3, 4, 5, 6].map((d) => `<option value="${d}" ${d === depth ? 'selected' : ''}>${d} etapas</option>`).join('')}</select>
        <select class="sel" id="jr-top" aria-label="Páginas por etapa">${[4, 6, 8, 12].map((d) => `<option value="${d}" ${d === topN ? 'selected' : ''}>${d} páginas por etapa</option>`).join('')}</select>
      </div>
    </div>
    <section class="panel" style="margin-bottom:16px" id="sk-box">${total ? '' : '<div class="empty"><h2>Sem sessões nesse recorte</h2>Escolha outro período ou outra página inicial.</div>'}</section>
    <section class="panel"><div class="panel-head"><h2>Caminhos mais comuns</h2><span class="muted small">${fmtInt(total)} sessões</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Caminho</th><th class="n">Sessões</th><th class="n">%</th></tr></thead><tbody>
      ${jr.rows.slice(0, 20).map((r) => `<tr><td><div class="path-crumbs">${r.path.map((p) => `<span title="${esc(p)}">${esc(p)}</span>`).join('<em>›</em>')}${r.more ? '<em>› continua</em>' : r.conv ? `<em style="color:var(--good)">› ${esc(site()?.goal_label || 'converteu')}</em>` : '<em>› saída</em>'}</div></td><td class="n">${fmtInt(r.n)}</td><td class="n">${fmtPct(r.n / total)}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  $('#jr-start').onchange = (e) => nav('start', e.target.value);
  const c = $('#jr-clear'); if (c) c.onclick = () => nav('start', '');
  $('#jr-depth').onchange = (e) => { lsSet('jr_depth', +e.target.value); nav('depth', e.target.value); };
  $('#jr-top').onchange = (e) => nav('top', e.target.value);
  if (!total) return;

  // ------------------------------------------------------------ monta nós por etapa
  const EXIT = 'Saiu do site', OTHER = 'Outras páginas', GOAL = '✓ ' + (site()?.goal_label || 'Converteu');
  const stepTotals = Array.from({ length: depth }, () => new Map());
  for (const r of jr.rows) r.path.forEach((p, i) => stepTotals[i].set(p, (stepTotals[i].get(p) || 0) + r.n));
  const keep = stepTotals.map((m) => new Set([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map((x) => x[0])));
  const name = (i, p) => (keep[i].has(p) ? p : OTHER);
  const nodes = new Map(), links = new Map();
  const node = (i, label) => { const id = i + '|' + label; if (!nodes.has(id)) nodes.set(id, { id, step: i, label }); return id; };
  for (const r of jr.rows) {
    const ids = r.path.map((p, i) => node(i, name(i, p)));
    if (!r.more && r.path.length < depth) ids.push(node(r.path.length, r.conv ? GOAL : EXIT));
    for (let i = 0; i < ids.length - 1; i++) {
      const k = ids[i] + '>' + ids[i + 1];
      links.set(k, (links.get(k) || 0) + r.n);
    }

  }
  const nodeArr = [...nodes.values()];
  const idx = new Map(nodeArr.map((n, i) => [n.id, i]));
  const linkArr = [...links.entries()].map(([k, v]) => { const [a, b] = k.split('>'); return { source: idx.get(a), target: idx.get(b), value: v }; });

  const box = $('#sk-box');
  const W = Math.max(720, box.clientWidth - 40), H = Math.max(360, Math.min(720, 60 + topN * 58));
  const { sankey, sankeyLinkHorizontal, sankeyLeft } = window.RV;
  const sk = sankey().nodeAlign(sankeyLeft).nodeWidth(12).nodePadding(14).extent([[0, 28], [W - 170, H - 6]])
    .nodeSort((a, b) => (a.label === GOAL) - (b.label === GOAL) || (a.label === EXIT) - (b.label === EXIT) || (a.label === OTHER) - (b.label === OTHER) || b.value - a.value);
  const graph = sk({ nodes: nodeArr.map((d) => ({ ...d })), links: linkArr.map((d) => ({ ...d })) });
  const colorOf = new Map(); let ci = 0;
  const col = (n) => {
    if (n.label === EXIT) return '#c9ccd6';
    if (n.label === GOAL) return '#1a8a5f';
    if (n.label === OTHER) return '#8a90a3';
    if (!colorOf.has(n.label)) colorOf.set(n.label, NODE_COLORS[ci++ % (NODE_COLORS.length - 1)]);
    return colorOf.get(n.label);
  };
  const stepTot = Array.from({ length: depth + 1 }, (_, i) => graph.nodes.filter((n) => n.step === i).reduce((a, n) => a + n.value, 0));
  const linkPath = sankeyLinkHorizontal();
  box.innerHTML = `<div style="overflow-x:auto"><svg class="sankey" viewBox="0 0 ${W} ${H}" style="min-width:${W}px;height:${H}px">
    ${Array.from({ length: depth + 1 }, (_, i) => { const xs = graph.nodes.find((n) => n.step === i); return xs ? `<text class="step-h" x="${xs.x0}" y="14">${i === 0 ? (start ? 'Início' : 'Entrada') : i === depth ? 'Fim' : 'Etapa ' + (i + 1)}</text>` : ''; }).join('')}
    <g>${graph.links.map((l, i) => `<path class="link" data-l="${i}" d="${linkPath(l)}" stroke="${col(l.source)}" stroke-width="${Math.max(1, l.width)}"/>`).join('')}</g>
    <g>${graph.nodes.map((n, i) => `<g class="node" data-n="${i}" style="cursor:${n.label === EXIT || n.label === OTHER || n.label === GOAL ? 'default' : 'pointer'}">
      <rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${Math.max(2, n.y1 - n.y0)}" fill="${col(n)}"/>
      ${n.y1 - n.y0 > 8 || n.value / stepTot[n.step] > 0.03 ? `<text x="${n.x1 + 6}" y="${(n.y0 + n.y1) / 2 - 2}">${esc(n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label)}</text>
      <text class="cnt" x="${n.x1 + 6}" y="${(n.y0 + n.y1) / 2 + 12}">${fmtInt(n.value)} (${fmtPct(n.value / stepTot[n.step], 0)})</text>` : ''}
    </g>`).join('')}</g></svg></div>`;
  $$('.link', box).forEach((p) => {
    const l = graph.links[+p.dataset.l];
    p.onmousemove = (e) => showTip(`<b>${esc(l.source.label)}</b> → <b>${esc(l.target.label)}</b><div class="tr"><span>Sessões</span><span>${fmtInt(l.value)}</span></div><div class="tr"><span>De quem estava em ${esc(l.source.label.slice(0, 20))}</span><span>${fmtPct(l.value / l.source.value, 0)}</span></div>`, e.clientX, e.clientY);
    p.onmouseleave = hideTip;
  });
  $$('.node', box).forEach((g) => {
    const n = graph.nodes[+g.dataset.n];
    g.onmousemove = (e) => {
      const exit = n.sourceLinks.find((l) => l.target.label === EXIT);
      const conv = n.sourceLinks.find((l) => l.target.label === GOAL);
      showTip(`<b>${esc(n.label)}</b><div class="tr"><span>Sessões nesta etapa</span><span>${fmtInt(n.value)}</span></div>${conv ? `<div class="tr"><span>Converteram aqui</span><span>${fmtPct(conv.value / n.value, 0)}</span></div>` : ''}${exit ? `<div class="tr"><span>Saíram sem converter</span><span>${fmtPct(exit.value / n.value, 0)}</span></div>` : ''}${n.label !== EXIT && n.label !== OTHER && n.label !== GOAL ? '<div class="muted small" style="color:#aab0c2">Clique para começar a jornada aqui</div>' : ''}`, e.clientX, e.clientY);
    };
    g.onmouseleave = hideTip;
    g.onclick = () => { if (n.label !== EXIT && n.label !== OTHER && n.label !== GOAL) { hideTip(); nav('start', n.label); } };
  });
}

// ================================================================ funil
export async function renderFunnel(el, alive) {
  const key = 'funnel_' + S.siteId;
  let steps = lsGet(key, []);
  const { rows: labels } = await api('labels', baseParams());
  if (!alive()) return;
  if (!steps.length && labels.length >= 1) steps = [labels[0].label, '__goal__'];
  const stepName = (s) => (s === '__goal__' ? '✓ ' + (site()?.goal_label || 'Conversão') : s);

  el.innerHTML = `
    <div class="page-head"><div><h1>Funil</h1><p>Monte a sequência de páginas que leva à conversão e veja em que etapa as pessoas desistem. As etapas não precisam ser seguidas, só na ordem.</p></div></div>
    <section class="panel" style="margin-bottom:16px">
      <div class="panel-head"><h2>Etapas</h2></div>
      <div class="step-chips" id="chips"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <input class="inp" id="fn-add" list="fn-pages" placeholder="Adicionar etapa (página ou grupo)" style="width:min(360px,100%)">
        <datalist id="fn-pages">${labels.map((l) => `<option value="${esc(l.label)}">${fmtInt(l.n)} views</option>`).join('')}</datalist>
        <button class="btn" id="fn-add-b">Adicionar</button>
        <button class="btn" id="fn-add-goal">+ ${esc(site()?.goal_label || 'Conversão')} (etapa final)</button>
      </div>
    </section>
    <section class="panel" id="fn-res"></section>`;
  const chips = () => {
    $('#chips').innerHTML = steps.map((s, i) => `${i ? '<span class="arrow">→</span>' : ''}<span class="step-chip"><span title="${esc(stepName(s))}">${i + 1}. ${esc(stepName(s))}</span><button data-rm="${i}" aria-label="Remover etapa">×</button></span>`).join('') || '<span class="muted">Adicione pelo menos duas etapas.</span>';
    $$('[data-rm]').forEach((b) => (b.onclick = () => { steps.splice(+b.dataset.rm, 1); save(); }));
  };
  const save = () => { lsSet(key, steps); chips(); compute(); };
  const add = () => {
    const v = $('#fn-add').value.trim();
    if (!v || steps.length >= 12) return;
    const hasGoal = steps.at(-1) === '__goal__';
    if (hasGoal) steps.splice(steps.length - 1, 0, v); else steps.push(v);
    $('#fn-add').value = ''; save();
  };
  $('#fn-add-goal').onclick = () => { if (steps.at(-1) !== '__goal__') { steps = steps.filter((x) => x !== '__goal__'); steps.push('__goal__'); save(); } };
  $('#fn-add-b').onclick = add;
  $('#fn-add').onkeydown = (e) => { if (e.key === 'Enter') add(); };

  async function compute() {
    const box = $('#fn-res');
    if (steps.length < 2) { box.innerHTML = '<div class="empty">Adicione pelo menos duas etapas para calcular o funil.</div>'; return; }
    box.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    const r = await api('funnel', baseParams({ steps: JSON.stringify(steps) }));
    if (!alive()) return;
    const first = r.counts[0] || 0;
    const conv = first ? r.counts[r.counts.length - 1] / first : 0;
    box.innerHTML = `
      <div class="panel-head"><h2>Conversão do funil: ${fmtPct(conv)}</h2><span class="muted small">${fmtInt(first)} sessões entraram, ${fmtInt(r.counts.at(-1))} chegaram ao fim, de ${fmtInt(r.total)} no período</span></div>
      <div class="funnel">${r.steps.map((s, i) => {
        const n = r.counts[i], prev = i ? r.counts[i - 1] : n;
        const drop = prev - n;
        return `${i ? `<div class="f-drop"><div></div><div>${drop > 0 ? `${fmtInt(drop)} desistiram (${fmtPct(prev ? drop / prev : 0, 0)})` : 'Ninguém desistiu'}</div><div></div></div>` : ''}
        <div class="f-step"><div class="f-name" title="${esc(stepName(s))}">${esc(stepName(s))}<small>${s === '__goal__' ? 'Conversão' : 'Etapa ' + (i + 1)}</small></div>
          <div class="f-bar"><i style="${s === '__goal__' ? 'background:var(--good);' : ''}width:${first ? (n / first) * 100 : 0}%"></i><span>${fmtInt(n)}</span></div>
          <div class="num">${i ? fmtPct(prev ? n / prev : 0, 0) + ' da etapa anterior' : 'Entrada'}</div></div>`;
      }).join('')}</div>`;
  }
  chips();
  compute();
}
