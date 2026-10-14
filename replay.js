// Rastro — reprodução de sessão (rrweb-player) com linha do tempo de eventos
import { api, esc, fmtDur, fmtClock, fmtDate, devIcon, devName, go, $, $$, icon, toast } from './app.js';
import { loadEvents } from './chunks.js';

function isGoalHref(m, goal) {
  if (!m || !m.href) return false;
  const pats = String(goal || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return pats.length ? pats.some((p) => m.href.toLowerCase().includes(p)) : m.out === '1';
}

export async function renderReplay(el, alive, id) {
  const d = await api('session', { id });
  if (!alive()) return;
  const s = d.session;
  let list = [];
  try { list = JSON.parse(sessionStorage.getItem('rastro_list') || '[]'); } catch {}
  const pos = list.indexOf(id);
  const prev = pos > 0 ? list[pos - 1] : null, next = pos > -1 && pos < list.length - 1 ? list[pos + 1] : null;
  const src = s.utm_source || (s.referrer ? s.referrer.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Direto');

  el.innerHTML = `
    <div class="page-head">
      <div><a class="btn ghost sm" href="#/sessions" style="margin-left:-10px">${icon('back')} Sessões</a>
        <h1 style="margin-top:6px">Sessão de ${fmtDate(s.started_at).toLowerCase()}</h1>
        <p>${devIcon(s.device)} ${devName(s.device)}, ${esc(s.browser || '')} no ${esc(s.os || '')}, tela ${s.screen_w}×${s.screen_h}. ${fmtDur(s.duration_ms)} e ${s.pageviews} página${s.pageviews > 1 ? 's' : ''}.</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="prev" ${prev ? '' : 'disabled'}>Anterior</button>
        <button class="btn" id="next" ${next ? '' : 'disabled'}>Próxima</button>
      </div>
    </div>
    <div class="replay-layout">
      <div><div class="player-box" id="player"><span class="spin"></span>&nbsp; Carregando gravação…</div></div>
      <aside>
        <section class="panel" style="margin-bottom:12px">
          <dl class="meta-grid">
            <dt>Origem</dt><dd title="${esc(s.referrer || '')}">${esc(src)}${s.utm_campaign ? ' / ' + esc(s.utm_campaign) : ''}</dd>
            <dt>Entrada</dt><dd title="${esc(s.landing_path || '')}">${esc(s.landing_path || '—')}</dd>
            <dt>Saída</dt><dd title="${esc(s.exit_path || '')}">${esc(s.exit_path || '—')}</dd>
            <dt>Visitante</dt><dd>${s.is_new ? 'Novo' : 'Recorrente'} <a href="#/sessions?visitor=${encodeURIComponent(s.visitor_id || '')}" class="small">outras sessões</a></dd>
            <dt>Idioma</dt><dd>${esc(s.lang || '—')}, ${esc(s.tz || '')}</dd>
            <dt>Conversão</dt><dd>${s.conv ? `<span class="badge good">${esc(s.goal_label || 'converteu')}</span>` : '<span class="muted">não converteu</span>'}</dd>
            <dt>Sinais</dt><dd>${s.rage_clicks ? `<span class="badge bad">${s.rage_clicks} rage</span> ` : ''}${s.dead_clicks ? `<span class="badge warn">${s.dead_clicks} sem resposta</span> ` : ''}${s.errors ? `<span class="badge bad">${s.errors} erro${s.errors > 1 ? 's' : ''}</span>` : ''}${!s.rage_clicks && !s.dead_clicks && !s.errors ? '<span class="muted">nenhum</span>' : ''}</dd>
          </dl>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Linha do tempo</h2><label class="toggle small"><input type="checkbox" id="only-sig"> Só problemas</label></div>
          <div class="timeline" id="tl"></div>
        </section>
        <div style="margin-top:12px;text-align:right"><button class="btn sm ghost danger" id="del">${icon('trash')} Excluir sessão</button></div>
      </aside>
    </div>`;
  const nav = (x) => x && go('#/session/' + x);
  $('#prev').onclick = () => nav(prev);
  $('#next').onclick = () => nav(next);
  $('#del').onclick = async () => {
    if (!confirm('Excluir esta sessão e a gravação dela?')) return;
    await api('session/' + id, {}, { method: 'DELETE' });
    toast('Sessão excluída'); go('#/sessions');
  };

  // linha do tempo
  const t0 = new Date(s.started_at).getTime();
  const items = [
    ...d.pageviews.map((p) => ({ k: 'pv', ts: new Date(p.ts).getTime(), a: p.title || p.path, b: p.path + ' / ' + fmtDur(p.duration_ms) + (p.doc_h ? ', rolou ' + Math.min(100, Math.round((Math.max(p.max_scroll_px, p.vh || 0) / p.doc_h) * 100)) + '%' : ''), path: p.path })),
    ...d.events.map((e) => {
      const href = e.meta?.href || '';
      const isGoal = e.type === 'click' && href && isGoalHref(e.meta, s.goal);
      let host = ''; try { host = href ? new URL(href).hostname.replace(/^www\./, '') : ''; } catch {}
      return {
        k: isGoal ? 'goal' : e.type, ts: new Date(e.ts).getTime(),
        a: isGoal ? (s.goal_label || 'Conversão') + (e.txt ? ': ' + e.txt : '') : { click: 'Clique', rage: 'Rage click', dead: 'Clique sem resposta', error: 'Erro JS' }[e.type] + (e.txt && e.type !== 'error' ? ': ' + e.txt : ''),
        b: e.type === 'error' ? e.txt : href && e.meta?.out === '1' ? 'Foi para ' + host : '',
      };
    }),
  ].sort((a, b) => a.ts - b.ts);
  let startTs = t0;
  const drawTl = () => {
    const only = $('#only-sig').checked;
    $('#tl').innerHTML = items.filter((it) => !only || ['rage', 'dead', 'error', 'pv', 'goal'].includes(it.k)).map((it, i) => `
      <div class="tl-item ${it.k === 'pv' ? 'pv-item' : ''}" data-ts="${it.ts}">
        <span class="t">${fmtClock(it.ts - startTs)}</span><span class="d ${it.k}"></span>
        <div class="x"><div title="${esc(it.a)}">${esc(it.a)}</div>${it.b ? `<div class="muted small" title="${esc(it.b)}">${esc(it.b)}</div>` : ''}
        ${it.k === 'pv' ? `<a class="small" href="#/heatmap?page=${encodeURIComponent(it.path)}&device=${s.device}" data-stop>Ver mapa de calor</a>` : ''}</div>
      </div>`).join('') || '<div class="muted small">Sem eventos.</div>';
    $$('.tl-item', $('#tl')).forEach((x) => (x.onclick = (e) => { if (e.target.closest('[data-stop]')) return; seek(+x.dataset.ts); }));
  };
  $('#only-sig').onchange = drawTl;
  drawTl();

  // player
  let player = null;
  const seek = (ts) => { if (player) { player.goto(Math.max(0, ts - startTs - 800), true); } };
  const box = $('#player');
  if (!d.chunks.length) {
    box.innerHTML = '<div class="empty" style="color:#aab0c2"><h2 style="color:#fff">Sessão sem gravação</h2>Esta sessão ficou fora da amostra de gravação ou foi gravada antes da instalação completa. Os eventos ao lado continuam válidos.</div>';
    return;
  }
  let events;
  try { events = await loadEvents(d.chunks); } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  if (!alive()) return;
  if (!events.some((e) => e.type === 2)) {
    box.innerHTML = '<div class="empty" style="color:#aab0c2"><h2 style="color:#fff">Gravação incompleta</h2>O início da gravação não chegou ao servidor (o visitante provavelmente fechou a página muito rápido).</div>';
    return;
  }
  startTs = events[0].timestamp;
  drawTl();
  box.innerHTML = '';
  const w = box.clientWidth - 24;
  const h = Math.max(320, Math.min(innerHeight - 280, w * 0.62));
  player = new window.RV.Player({
    target: box,
    props: { events, width: w, height: h, autoPlay: true, skipInactive: true, showController: true, speedOption: [1, 2, 4, 8], mouseTail: { strokeStyle: '#ffd23f', lineWidth: 2 }, UNSAFE_replayCanvas: false },
  });
  // destaca o item atual da linha do tempo
  let last = null;
  player.addEventListener('ui-update-current-time', (e) => {
    if (!document.body.contains(box)) { try { player.pause(); } catch {} return; }
    const now = startTs + (e.payload || 0);
    let cur = null;
    for (const x of $$('.tl-item', $('#tl'))) { if (+x.dataset.ts <= now + 300) cur = x; else break; }
    if (cur !== last) { last?.classList.remove('now'); cur?.classList.add('now'); last = cur; }
  });
}
