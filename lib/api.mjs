// Rastro — API (coleta pública + relatórios protegidos por senha)
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { q, one, backend } from './db.mjs';
import { replay, inbox, meta, getJSON, putJSON } from './store.mjs';

const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? (globalThis.Deno?.env?.get?.(k)) ?? globalThis.process?.env?.[k];
// DIRECT: grava cada lote direto no banco (Supabase, sempre ligado). Sem DIRECT: fila no Blobs (Netlify Database).
const DIRECT = () => !!globalThis.Deno || env('HM_DIRECT') === '1';

// ---------------------------------------------------------------- utils
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const err = (msg, status = 400, headers = {}) => json({ error: msg }, status, headers);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- auth
// Senha do painel: variável HM_PASSWORD, ou (sem ela) o hash guardado no banco em hm_meta('auth_pw_sha256')
let auth = { pw: null, secret: '' }, authAt = 0;
const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');
async function loadAuth() {
  if (env('HM_PASSWORD')) { auth = { pw: sha256(env('HM_PASSWORD')), secret: env('HM_SECRET') || env('HM_PASSWORD') }; return auth; }
  if (Date.now() - authAt < 300e3) return auth;
  try {
    const rows = await q(`select k, v from hm_meta where k in ('auth_pw_sha256', 'auth_secret')`);
    const m = Object.fromEntries(rows.map((r) => [r.k, r.v]));
    auth = { pw: m.auth_pw_sha256 || null, secret: m.auth_secret || m.auth_pw_sha256 || '' };
    authAt = Date.now();
  } catch { /* banco indisponível: mantém o que tinha */ }
  return auth;
}
function secret() { return auth.secret || ''; }
function sign(payload) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
export function makeToken(days = 30) {
  const p = Buffer.from(JSON.stringify({ exp: Date.now() + days * 864e5, n: randomBytes(6).toString('hex') })).toString('base64url');
  return p + '.' + sign(p);
}
function verifyToken(t) {
  if (!t || !secret()) return false;
  const [p, s] = t.split('.');
  if (!p || !s) return false;
  const a = Buffer.from(sign(p)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function authed(req) {
  const h = req.headers.get('authorization') || '';
  return verifyToken(h.replace(/^Bearer\s+/i, ''));
}

// ---------------------------------------------------------------- config pública dos sites (no Blobs, para a coleta não acordar o banco)
let siteMap = null, siteMapAt = 0;
export async function syncSitesConfig() {
  if (DIRECT()) { siteMap = null; siteCache.clear(); return {}; }
  const rows = await q(`select id, site_key, domains, replay_sample, mask_text from hm_sites`);
  const map = Object.fromEntries(rows.map((r) => [r.site_key, { id: r.id, domains: r.domains, replay_sample: r.replay_sample, mask_text: r.mask_text }]));
  await putJSON(meta(), 'sites', map);
  siteMap = map; siteMapAt = Date.now();
  return map;
}
const siteCache = new Map();
async function siteByKey(key) {
  if (DIRECT()) {
    const c = siteCache.get(key);
    if (c && Date.now() - c.t < 60e3) return c.site;
    const site = await one(`select id, domains, replay_sample, mask_text from hm_sites where site_key = $1`, [key]);
    siteCache.set(key, { site, t: Date.now() });
    return site;
  }
  if (!siteMap || Date.now() - siteMapAt > 60e3) {
    siteMap = await getJSON(meta(), 'sites', null);
    siteMapAt = Date.now();
    if (!siteMap) siteMap = await syncSitesConfig().catch(() => ({}));
  }
  return siteMap[key] || null;
}
function originAllowed(site, req) {
  const domains = (site.domains || []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (!domains.length) return true;
  const src = req.headers.get('origin') || req.headers.get('referer') || '';
  let host = '';
  try { host = new URL(src).hostname.toLowerCase(); } catch { return false; }
  return domains.some((d) => host === d || host.endsWith('.' + d));
}

// ---------------------------------------------------------------- coleta
async function collect(req) {
  const text = await req.text();
  if (text.length > 5_500_000) return err('payload too large', 413, CORS);
  let p;
  try { p = JSON.parse(text); } catch { return err('bad json', 400, CORS); }
  if (!p || typeof p.k !== 'string' || !p.s || !UUID.test(p.s.id || '')) return err('bad payload', 400, CORS);
  const site = await siteByKey(p.k);
  if (!site) return err('unknown site', 404, CORS);
  if (!originAllowed(site, req)) return err('origin not allowed', 403, CORS);

  // gravações de replay vão direto para o Blobs; o lote (com as chaves) entra na fila
  const chunks = Array.isArray(p.r) ? p.r.slice(0, 20) : [];
  p.r = [];
  for (const c of chunks) {
    if (!c || typeof c.d !== 'string' || !UUID.test(c.pv || '')) continue;
    const bytes = Buffer.from(c.d, 'base64');
    if (!bytes.length || bytes.length > 5_000_000) continue;
    const key = `${site.id}/${p.s.id}/${Date.now()}-${c.seq | 0}-${randomBytes(3).toString('hex')}`;
    await replay().set(key, bytes);
    p.r.push({ pv: c.pv, seq: c.seq | 0, ts: c.ts, snap: !!c.snap, enc: c.enc === 'raw' ? 'raw' : 'gz', size: bytes.length, key });
  }
  p.p = (Array.isArray(p.p) ? p.p : []).filter((x) => x && UUID.test(x.id || '')).slice(0, 5);
  p.e = (Array.isArray(p.e) ? p.e : []).filter((e) => e && (!e.pv || UUID.test(e.pv))).slice(0, 3000);
  if (!p.p.length && !p.e.length && !p.r.length) return json({ ok: true }, 200, CORS);
  if (DIRECT()) {
    await one(`select hm_ingest($1::jsonb, $2::uuid) as r`, [JSON.stringify(p), site.id]);
    maybeCleanup();
    return json({ ok: true }, 202, CORS);
  }
  const key = `${String(Date.now()).padStart(15, '0')}-${randomBytes(4).toString('hex')}`;
  await inbox().set(key, JSON.stringify({ site: site.id, p }));
  return json({ ok: true }, 202, CORS);
}

// ---------------------------------------------------------------- fila -> banco
const FLUSH_BATCH = 150;
export async function flush(budgetMs = 8000) {
  const t0 = Date.now();
  const ib = inbox();
  const keys = await ib.list();
  let processed = 0, failed = 0, i = 0;
  while (i < keys.length && Date.now() - t0 < budgetMs) {
    const slice = keys.slice(i, i + FLUSH_BATCH);
    i += slice.length;
    const items = [];
    for (let j = 0; j < slice.length; j += 25) {
      const part = await Promise.all(slice.slice(j, j + 25).map((k) => getJSON(ib, k, null)));
      items.push(...part);
    }
    const valid = items.filter((x) => x && x.site && x.p);
    if (valid.length) {
      const r = await one(`select hm_ingest_many($1::jsonb) as r`, [JSON.stringify(valid)]);
      processed += r?.r?.ok || 0; failed += r?.r?.failed || 0;
    }
    for (let j = 0; j < slice.length; j += 25) await Promise.all(slice.slice(j, j + 25).map((k) => ib.delete(k)));
  }
  const now = new Date().toISOString();
  await putJSON(meta(), 'last_flush', { at: now, processed, failed });
  return { processed, failed, remaining: keys.length - i, at: now };
}

async function config(url) {
  const site = await siteByKey(url.searchParams.get('k') || '');
  if (!site) return err('unknown site', 404, CORS);
  return json({ rs: site.replay_sample, mt: site.mask_text }, 200, { ...CORS, 'cache-control': 'public, max-age=300' });
}

// ---------------------------------------------------------------- filtros comuns
function filters(url) {
  const site = url.searchParams.get('site');
  if (!UUID.test(site || '')) throw new HttpError(400, 'site inválido');
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')) : new Date();
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')) : new Date(to - 30 * 864e5);
  if (isNaN(from) || isNaN(to)) throw new HttpError(400, 'datas inválidas');
  const device = ['desktop', 'tablet', 'mobile'].includes(url.searchParams.get('device')) ? url.searchParams.get('device') : null;
  const grouped = url.searchParams.get('grouped') === '1';
  const tz = url.searchParams.get('tz') || 'America/Sao_Paulo';
  return { site, from: from.toISOString(), to: to.toISOString(), device, grouped, tz, span: to - from };
}
class HttpError extends Error { constructor(s, m) { super(m); this.status = s; } }

// $1 site, $2 from, $3 to, $4 device
// conv = a sessão clicou num link de conversão (ex.: botão da ticketeria) — não conta como rejeição/saída
const S_CTE = `s as (select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv
  from hm_sessions ss join hm_sites st on st.id = ss.site_id
  where ss.site_id = $1 and ss.started_at >= $2 and ss.started_at < $3 and ($4::text is null or ss.device = $4))`;
const LABEL = (g) => (g ? `hm_label($1, pv.path)` : `pv.path`);

// ---------------------------------------------------------------- relatórios
async function overview(url) {
  const f = filters(url);
  const base = [f.site, f.from, f.to, f.device];
  const prevFrom = new Date(new Date(f.from) - f.span).toISOString();
  const bucket = f.span <= 2.1 * 864e5 ? 'hour' : 'day';
  const kpiSql = `with ${S_CTE}
    select count(*)::int sessions, count(distinct visitor_id)::int visitors, coalesce(sum(pageviews),0)::int pageviews,
      avg((pageviews <= 1 and not conv)::int)::float bounce, avg(duration_ms)::float avg_duration, avg(pageviews)::float pps,
      avg(conv::int)::float conversion, count(*) filter (where conv)::int conversions,
      avg((rage_clicks > 0)::int)::float rage, avg((dead_clicks > 0)::int)::float dead, avg((errors > 0)::int)::float errors,
      avg(is_new::int)::float new_visitors, count(*) filter (where has_replay)::int replays,
      (select avg(least(100, pv.max_scroll_px * 100.0 / nullif(pv.doc_h, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float scroll,
      (select avg(least(1, pv.active_ms * 1.0 / nullif(pv.duration_ms, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float activity
    from s`;
  const [kpis, prev, series, devices, channels, refs, landings, errors, browsers] = await Promise.all([
    one(kpiSql, base),
    one(kpiSql, [f.site, prevFrom, f.from, f.device]),
    q(`with ${S_CTE}, b as (
        select generate_series(date_trunc('${bucket}', $2::timestamptz at time zone $5), date_trunc('${bucket}', $3::timestamptz at time zone $5), interval '1 ${bucket}') b)
       select to_char(b.b, 'YYYY-MM-DD"T"HH24:MI') b, count(s.id)::int sessions, coalesce(sum(s.pageviews),0)::int pageviews,
         count(s.id) filter (where s.conv)::int converted,
         count(s.id) filter (where s.rage_clicks > 0 or s.dead_clicks > 0 or s.errors > 0)::int frustrated
       from b left join s on date_trunc('${bucket}', s.started_at at time zone $5) = b.b group by b.b order by b.b`, [...base, f.tz]),
    q(`with ${S_CTE} select coalesce(device,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(duration_ms)::float dur from s group by 1 order by 2 desc`, base),
    q(`with ${S_CTE}, c as (select *, case
          when coalesce(utm_medium,'') ~* '(cpc|ppc|paid|ads)' then 'Mídia paga'
          when coalesce(utm_medium,'') ~* 'email' then 'E-mail'
          when coalesce(utm_source,'') <> '' and coalesce(utm_medium,'') ~* 'social' then 'Social'
          when coalesce(utm_source,'') <> '' then 'Campanha (UTM)'
          when coalesce(referrer,'') = '' then 'Direto'
          when referrer ~* '(google|bing|yahoo|duckduckgo|ecosia|yandex)\\.' then 'Busca orgânica'
          when referrer ~* '(facebook|instagram|t\\.co|twitter|x\\.com|linkedin|tiktok|youtube|pinterest|whatsapp|threads)' then 'Social'
          else 'Referência' end ch from s)
        select ch k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv from c group by 1 order by 2 desc`, base),
    q(`with ${S_CTE} select coalesce(nullif(substring(referrer from '^[a-z]+://([^/:]+)'),''), '(direto)') k, count(*)::int n
       from s group by 1 order by 2 desc limit 10`, base),
    q(`with ${S_CTE} select coalesce(landing_path,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(duration_ms)::float dur
       from s group by 1 order by 2 desc limit 10`, base),
    q(`with ${S_CTE} select e.txt k, count(*)::int n, count(distinct e.session_id)::int sessions, max(e.path) path
       from hm_events e join s on s.id = e.session_id where e.site_id = $1 and e.type = 'error' group by 1 order by 3 desc limit 10`, base),
    q(`with ${S_CTE} select coalesce(browser,'?') || ' · ' || coalesce(os,'?') k, count(*)::int n from s group by 1 order by 2 desc limit 8`, base),
  ]);
  return json({ kpis, prev, bucket, series, devices, channels, refs, landings, errors, browsers });
}

async function pages(url) {
  const f = filters(url);
  const rows = await q(`with ${S_CTE},
    pv as (
      select pv.*, s.conv, ${LABEL(f.grouped)} label,
        row_number() over w rn, count(*) over (partition by pv.session_id) cnt,
        lag(pv.path) over w prev_path, lead(pv.path) over w next_path
      from hm_pageviews pv join s on s.id = pv.session_id
      window w as (partition by pv.session_id order by pv.seq)
    ),
    ev as (
      select e.pageview_id,
        count(*) filter (where type = 'rage') rage, count(*) filter (where type = 'dead') dead, count(*) filter (where type = 'error') err,
        count(*) filter (where type = 'click' and hm_is_goal(e.meta, (select goal from hm_sites where id = $1))) goal
      from hm_events e join s on s.id = e.session_id
      where e.site_id = $1 and e.type in ('rage','dead','error','click') group by 1
    )
    select label, count(*)::int views, count(distinct session_id)::int sessions,
      count(*) filter (where rn = 1)::int landings,
      count(*) filter (where rn = cnt and not pv.conv)::int exits,
      count(*) filter (where rn = 1 and cnt = 1 and not pv.conv)::int bounces,
      count(*) filter (where coalesce(ev.goal,0) > 0)::int goal_pv,
      avg(duration_ms)::float avg_time,
      avg(least(100, max_scroll_px * 100.0 / nullif(doc_h, 0)))::float scroll,
      avg(least(1, active_ms * 1.0 / nullif(duration_ms, 0)))::float activity,
      avg(pv.clicks)::float clicks,
      count(*) filter (where coalesce(ev.rage,0) > 0)::int rage_pv,
      count(*) filter (where coalesce(ev.dead,0) > 0)::int dead_pv,
      count(*) filter (where coalesce(ev.err,0) > 0)::int err_pv,
      count(*) filter (where prev_path is not null and prev_path = next_path and duration_ms < 10000)::int uturns,
      avg(doc_h)::float doc_h
    from pv left join ev on ev.pageview_id = pv.id
    group by label order by views desc limit 500`, [f.site, f.from, f.to, f.device]);
  return json({ rows });
}

async function heatmap(url) {
  const f = filters(url);
  const page = url.searchParams.get('page') || '/';
  const device = f.device || 'desktop';
  const args = [f.site, f.from, f.to, device, page];
  const PVS = `${S_CTE}, pvs as (
      select pv.* from hm_pageviews pv join s on s.id = pv.session_id
      where pv.site_id = $1 and ${f.grouped ? 'hm_label($1, pv.path)' : 'pv.path'} = $5)`;
  const [summary, reach, clicks, frust, moves, zones, hovers, snaps] = await Promise.all([
    one(`with ${PVS} select count(*)::int pageviews, count(distinct session_id)::int sessions,
          percentile_disc(0.5) within group (order by vw) vw, avg(vh)::int vh, avg(doc_h)::int doc_h,
          avg(duration_ms)::float avg_time, avg(clicks)::float clicks
         from pvs`, args),
    q(`with ${PVS} select least(100, round(greatest(max_scroll_px, vh) * 100.0 / nullif(doc_h, 0)))::int r from pvs where doc_h > 0 limit 20000`, args),
    q(`with ${PVS} select e.sel, e.ox, e.oy, e.x, e.y, e.w from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' order by e.id desc limit 40000`, args),
    q(`with ${PVS} select e.type, e.sel, e.ox, e.oy, e.x, e.y, e.w, e.txt from hm_events e join pvs on pvs.id = e.pageview_id where e.type in ('rage','dead') order by e.id desc limit 10000`, args),
    q(`with ${PVS} select e.x, e.y, e.w, sum(e.val)::int v from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'move' group by 1,2,3 order by 4 desc limit 40000`, args),
    q(`with ${PVS} select e.sel, count(*)::int clicks, count(distinct e.pageview_id)::int pv, max(e.txt) txt,
          min(e.y) y
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' group by 1 order by 2 desc limit 2000`, args),
    q(`with ${PVS} select e.sel, sum(e.val)::bigint ms, count(distinct e.pageview_id)::int pv, max(e.txt) txt
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'hover' group by 1 order by 2 desc limit 2000`, args),
    q(`with ${PVS} select r.pageview_id pv, pvs.vw, pvs.vh, pvs.doc_h, pvs.url, r.ts
         from hm_replay r join pvs on pvs.id = r.pageview_id where r.has_snapshot order by r.ts desc limit 8`, args),
  ]);
  return json({ device, page, summary, reach: reach.map((r) => r.r), clicks, frust, moves, zones, hovers, snaps });
}

async function snapshot(url) {
  const pv = url.searchParams.get('pv');
  if (!UUID.test(pv || '')) return err('pv inválido');
  const rows = await q(`select blob_key key, enc, seq, ts from hm_replay where pageview_id = $1 order by seq, ts limit 12`, [pv]);
  return json({ chunks: rows });
}

async function sessions(url) {
  const f = filters(url);
  const p = url.searchParams;
  const args = [f.site, f.from, f.to, f.device];
  const where = [];
  const add = (cond, v) => { args.push(v); where.push(cond.replaceAll('$?', '$' + args.length)); };
  if (p.get('replay') === '1') where.push('s.has_replay');
  if (p.get('frustration') === '1') where.push('(s.rage_clicks > 0 or s.dead_clicks > 0)');
  if (p.get('rage') === '1') where.push('s.rage_clicks > 0');
  if (p.get('errors') === '1') where.push('s.errors > 0');
  if (p.get('bounce') === '1') where.push('(s.pageviews <= 1 and not s.conv)');
  if (p.get('converted') === '1') where.push('s.conv');
  if (p.get('notconverted') === '1') where.push('not s.conv');
  if (p.get('new') === '1') where.push('s.is_new');
  if (+p.get('min_dur') > 0) add('s.duration_ms >= $?', +p.get('min_dur') * 1000);
  if (p.get('page')) add(`exists (select 1 from hm_pageviews x where x.session_id = s.id and x.path ilike $?)`, '%' + p.get('page') + '%');
  if (p.get('landing')) add('s.landing_path ilike $?', '%' + p.get('landing') + '%');
  if (p.get('source')) add(`(s.utm_source ilike $? or s.referrer ilike $?)`, '%' + p.get('source') + '%');
  if (p.get('visitor')) add('s.visitor_id = $?', p.get('visitor'));
  if (p.get('ids')) add('s.id = any($?::uuid[])', p.get('ids').split(',').filter((x) => UUID.test(x)));
  const lim = Math.min(200, +p.get('limit') || 50), off = Math.max(0, +p.get('offset') || 0);
  const W = where.length ? ' and ' + where.join(' and ') : '';
  const [rows, total] = await Promise.all([
    q(`with ${S_CTE} select s.id, s.visitor_id, s.started_at, s.duration_ms, s.pageviews, s.device, s.browser, s.os,
          s.referrer, s.utm_source, s.utm_campaign, s.landing_path, s.exit_path, s.clicks, s.rage_clicks, s.dead_clicks,
          s.errors, s.is_new, s.has_replay, s.screen_w, s.screen_h, s.lang, s.conv,
          (select array_agg(path order by seq) from (select path, seq from hm_pageviews x where x.session_id = s.id order by seq limit 10) t) paths
        from s where true ${W} order by s.started_at desc limit ${lim} offset ${off}`, args),
    one(`with ${S_CTE} select count(*)::int n from s where true ${W}`, args),
  ]);
  return json({ rows, total: total.n });
}

async function session(url) {
  const id = url.searchParams.get('id');
  if (!UUID.test(id || '')) return err('id inválido');
  const [s, pvs, events, chunks] = await Promise.all([
    one(`select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv,
           st.goal, st.goal_label from hm_sessions ss join hm_sites st on st.id = ss.site_id where ss.id = $1`, [id]),
    q(`select id, seq, url, path, title, ts, vw, vh, doc_h, max_scroll_px, duration_ms, active_ms, clicks from hm_pageviews where session_id = $1 order by seq`, [id]),
    q(`select type, ts, pageview_id pv, path, sel, txt, x, y, meta from hm_events where session_id = $1 and type in ('click','rage','dead','error') order by ts limit 3000`, [id]),
    q(`select blob_key key, enc, seq, ts, pageview_id pv, has_snapshot snap, size from hm_replay where session_id = $1 order by ts, seq, id`, [id]),
  ]);
  if (!s) return err('sessão não encontrada', 404);
  return json({ session: s, pageviews: pvs, events, chunks });
}

async function chunk(url) {
  const key = url.searchParams.get('key') || '';
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w-]+$/i.test(key)) return err('key inválida');
  const bytes = await replay().get(key);
  if (!bytes) return err('não encontrado', 404);
  return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=86400' } });
}

const LABELED = (g) => `${S_CTE}, seqs as (
    select session_id, bool_or(conv) conv, array_agg(label order by seq) labels from (
      select pv.session_id, s.conv, pv.seq, l.label, lag(l.label) over (partition by pv.session_id order by pv.seq) prev
      from hm_pageviews pv join s on s.id = pv.session_id
      cross join lateral (select ${LABEL(g)} label) l
    ) t where prev is distinct from label group by session_id)`;

async function journey(url) {
  const f = filters(url);
  const depth = Math.min(8, Math.max(2, +url.searchParams.get('depth') || 5));
  const start = url.searchParams.get('start') || null;
  const rows = await q(`with ${LABELED(f.grouped)},
    trimmed as (
      select conv, case when $5::text is null then labels else labels[array_position(labels, $5::text):] end labels
      from seqs where $5::text is null or array_position(labels, $5::text) is not null)
    select labels[1:${depth}] path, (cardinality(labels) > ${depth}) more, conv, count(*)::int n
    from trimmed group by 1, 2, 3 order by 4 desc limit 5000`, [f.site, f.from, f.to, f.device, start]);
  return json({ depth, rows });
}

async function funnel(url) {
  const f = filters(url);
  let steps = [];
  try { steps = JSON.parse(url.searchParams.get('steps') || '[]').map(String).slice(0, 12); } catch {}
  if (steps.length < 2) return err('informe pelo menos 2 etapas');
  if (steps.slice(0, -1).includes('__goal__')) return err('a conversão precisa ser a última etapa');
  const goalLast = steps[steps.length - 1] === '__goal__';
  const pageSteps = goalLast ? steps.slice(0, -1) : steps;
  const [lv, tot] = await Promise.all([
    q(`with ${LABELED(f.grouped)} select hm_funnel_level(labels, $5::text[]) lvl, conv, count(*)::int n from seqs group by 1, 2`,
      [f.site, f.from, f.to, f.device, pageSteps]),
    one(`with ${S_CTE} select count(*)::int n from s`, [f.site, f.from, f.to, f.device]),
  ]);
  const counts = pageSteps.map((_, i) => lv.filter((r) => r.lvl >= i + 1).reduce((a, r) => a + r.n, 0));
  if (goalLast) counts.push(lv.filter((r) => r.lvl >= pageSteps.length && r.conv).reduce((a, r) => a + r.n, 0));
  return json({ steps, counts, total: tot.n });
}

async function labels(url) {
  const f = filters(url);
  const rows = await q(`with ${S_CTE} select ${LABEL(f.grouped)} label, count(*)::int n
    from hm_pageviews pv join s on s.id = pv.session_id group by 1 order by 2 desc limit 400`, [f.site, f.from, f.to, f.device]);
  return json({ rows });
}

// ---------------------------------------------------------------- configurações
const SITE_COLS = `id, name, domains, site_key, replay_sample, mask_text, replay_days, data_days, goal, goal_label, created_at`;
function siteInput(b) {
  const domains = (Array.isArray(b.domains) ? b.domains : String(b.domains || '').split(/[\s,]+/))
    .map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''))
    .filter(Boolean).slice(0, 20);
  return [
    String(b.name || 'Novo site').slice(0, 80), domains,
    Math.min(1, Math.max(0, Number(b.replay_sample ?? 1))), !!b.mask_text,
    Math.min(365, Math.max(1, parseInt(b.replay_days ?? 30))), Math.min(730, Math.max(7, parseInt(b.data_days ?? 180))),
    String(b.goal ?? '').slice(0, 300), String(b.goal_label || 'Clicou no link de conversão').slice(0, 60),
  ];
}
async function sitesRoute(req, url, id) {
  if (req.method === 'GET') return json({ rows: await q(`select ${SITE_COLS},
      (select max(started_at) from hm_sessions x where x.site_id = hm_sites.id) last_seen
      from hm_sites order by created_at`) });
  if (req.method === 'POST') {
    const b = await req.json();
    const row = await one(`insert into hm_sites (name, domains, replay_sample, mask_text, replay_days, data_days, goal, goal_label)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${SITE_COLS}`, siteInput(b));
    await syncSitesConfig();
    return json(row);
  }
  if (!UUID.test(id || '')) return err('id inválido');
  if (req.method === 'PUT') {
    const b = await req.json();
    const row = await one(`update hm_sites set name=$2, domains=$3, replay_sample=$4, mask_text=$5, replay_days=$6, data_days=$7, goal=$8, goal_label=$9
      where id=$1 returning ${SITE_COLS}`, [id, ...siteInput(b)]);
    await syncSitesConfig();
    return json(row);
  }
  if (req.method === 'DELETE') {
    const keys = await q(`select blob_key from hm_replay where site_id = $1`, [id]);
    await delKeys(keys.map((k) => k.blob_key));
    await q(`delete from hm_sites where id = $1`, [id]);
    await syncSitesConfig();
    return json({ ok: true });
  }
  return err('método', 405);
}
async function groupsRoute(req, url, id) {
  if (req.method === 'GET') {
    const site = url.searchParams.get('site');
    if (!UUID.test(site || '')) return err('site inválido');
    return json({ rows: await q(`select * from hm_page_groups where site_id = $1 order by position, id`, [site]) });
  }
  if (req.method === 'POST') {
    const b = await req.json();
    if (!UUID.test(b.site_id || '') || !b.name || !b.pattern) return err('campos obrigatórios');
    const mt = ['exact', 'prefix', 'contains', 'regex'].includes(b.match_type) ? b.match_type : 'prefix';
    return json(await one(`insert into hm_page_groups (site_id, name, match_type, pattern, position)
      values ($1,$2,$3,$4, coalesce((select max(position)+1 from hm_page_groups where site_id=$1),0)) returning *`,
      [b.site_id, String(b.name).slice(0, 80), mt, String(b.pattern).slice(0, 300)]));
  }
  if (req.method === 'DELETE' && /^\d+$/.test(id || '')) {
    await q(`delete from hm_page_groups where id = $1`, [id]);
    return json({ ok: true });
  }
  return err('método', 405);
}

async function deleteSession(id) {
  if (!UUID.test(id || '')) return err('id inválido');
  const keys = await q(`select blob_key from hm_replay where session_id = $1`, [id]);
  await delKeys(keys.map((k) => k.blob_key));
  await q(`delete from hm_sessions where id = $1`, [id]);
  return json({ ok: true });
}

// ---------------------------------------------------------------- retenção
let cleanupCheckedAt = 0;
function maybeCleanup() {
  if (Date.now() - cleanupCheckedAt < 6 * 3600e3) return;
  cleanupCheckedAt = Date.now();
  const job = (async () => {
    const r = await one(`select v from hm_meta where k = 'last_cleanup'`);
    if (r && Date.now() - new Date(r.v).getTime() < 20 * 3600e3) return;
    await q(`insert into hm_meta (k, v) values ('last_cleanup', $1) on conflict (k) do update set v = excluded.v`, [new Date().toISOString()]);
    await cleanup();
  })().catch((e) => console.error('cleanup', e));
  globalThis.EdgeRuntime?.waitUntil?.(job);
}
const delKeys = async (keys) => {
  if (!keys.length) return;
  const st = replay();
  if (st.deleteMany) return st.deleteMany(keys).catch(() => {});
  for (const k of keys) await st.delete(k).catch(() => {});
};
export async function cleanup() {
  const old = await q(`select r.id, r.blob_key from hm_replay r join hm_sites s on s.id = r.site_id
                        where r.ts < now() - make_interval(days => s.replay_days) limit 5000`);
  await delKeys(old.map((r) => r.blob_key));
  if (old.length) await q(`delete from hm_replay where id = any($1::bigint[])`, [old.map((r) => r.id)]);
  await q(`update hm_sessions ss set has_replay = false where has_replay and not exists (select 1 from hm_replay r where r.session_id = ss.id)`);
  const dead = await q(`select r.blob_key from hm_replay r join hm_sessions ss on ss.id = r.session_id join hm_sites s on s.id = ss.site_id
                         where ss.started_at < now() - make_interval(days => s.data_days) limit 5000`);
  await delKeys(dead.map((r) => r.blob_key));
  await q(`delete from hm_sessions ss using hm_sites s where ss.site_id = s.id and ss.started_at < now() - make_interval(days => s.data_days)`);
  return { replays: old.length };
}

// ---------------------------------------------------------------- roteador
export async function handle(req) {
  const res = await route(req);
  // CORS em todas as respostas (o painel pode estar em outro domínio)
  for (const [k, v] of Object.entries(CORS)) if (!res.headers.has(k)) res.headers.set(k, v);
  return res;
}

async function route(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(\.netlify\/functions\/api|api|functions\/v1\/rastro|rastro)/, '').replace(/\/+$/, '') || '/';
  const [, head, id] = path.split('/');
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (head === 'collect' && req.method === 'POST') return await collect(req);
    if (head === 'config') return await config(url);
    if (head === 'health') { await loadAuth(); return json({ ok: true, auth: !!secret() }); }
    if (head === 'login' && req.method === 'POST') {
      await loadAuth();
      if (!auth.pw) return err('Senha do painel não configurada no servidor', 503);
      const { password } = await req.json().catch(() => ({}));
      const a = Buffer.from(sha256(String(password || ''))), b = Buffer.from(auth.pw);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        await new Promise((r) => setTimeout(r, 600));
        return err('Senha incorreta', 401);
      }
      return json({ token: makeToken() });
    }
    await loadAuth();
    if (!authed(req)) return err('não autenticado', 401);
    switch (head) {
      case 'sites': return await sitesRoute(req, url, id);
      case 'groups': return await groupsRoute(req, url, id);
      case 'overview': return await overview(url);
      case 'pages': return await pages(url);
      case 'heatmap': return await heatmap(url);
      case 'snapshot': return await snapshot(url);
      case 'sessions': return await sessions(url);
      case 'session': return req.method === 'DELETE' ? await deleteSession(id) : await session(url);
      case 'chunk': return await chunk(url);
      case 'journey': return await journey(url);
      case 'funnel': return await funnel(url);
      case 'labels': return await labels(url);
      case 'cleanup': return json(await cleanup());
      case 'flush': return json(DIRECT() ? { processed: 0, failed: 0, remaining: 0, at: new Date().toISOString() } : await flush(Math.min(20000, +url.searchParams.get('budget') || 7000)));
      case 'status': {
        if (DIRECT()) return json({ pending: 0, oldest: null, last: { at: new Date().toISOString() }, backend: 'direto' });
        const [pending, last] = await Promise.all([inbox().list(), getJSON(meta(), 'last_flush', null)]);
        return json({ pending: pending.length, oldest: pending[0] ? new Date(+pending[0].split('-')[0]).toISOString() : null, last, backend });
      }
    }
    return err('rota não encontrada', 404);
  } catch (e) {
    if (e instanceof HttpError) return err(e.message, e.status);
    console.error(e);
    const pub = head === 'collect' || head === 'config';
    return err('erro interno: ' + (e.message || e), 500, pub ? CORS : {});
  }
}
