// Schema do Rastro (Postgres). Para Netlify Database, o mesmo conteúdo está em
// netlify/database/migrations/20261013190000_rastro_init.sql (aplicado no deploy).
// Para outros Postgres (DATABASE_URL), é aplicado em tempo de execução. Cada item é um único statement
// (o driver HTTP do Neon executa um comando por chamada).
export const SCHEMA_VERSION = 2;

export const SCHEMA = [
  `create table if not exists hm_meta (k text primary key, v text)`,

  `create table if not exists hm_sites (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    domains       text[] not null default '{}',
    site_key      text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    replay_sample real not null default 1 check (replay_sample between 0 and 1),
    mask_text     boolean not null default false,
    replay_days   int not null default 30 check (replay_days between 1 and 365),
    data_days     int not null default 180 check (data_days between 7 and 730),
    created_at    timestamptz not null default now()
  )`,

  `create table if not exists hm_page_groups (
    id          bigint generated always as identity primary key,
    site_id     uuid not null references hm_sites(id) on delete cascade,
    name        text not null,
    match_type  text not null default 'prefix' check (match_type in ('exact','prefix','contains','regex')),
    pattern     text not null,
    position    int not null default 0
  )`,
  `create index if not exists hm_page_groups_site on hm_page_groups(site_id, position)`,

  `create table if not exists hm_sessions (
    id uuid primary key,
    site_id uuid not null references hm_sites(id) on delete cascade,
    visitor_id text, is_new boolean not null default true,
    started_at timestamptz not null, ended_at timestamptz not null,
    duration_ms int not null default 0, pageviews int not null default 0,
    clicks int not null default 0, rage_clicks int not null default 0,
    dead_clicks int not null default 0, errors int not null default 0,
    device text, browser text, os text, lang text, tz text,
    screen_w int, screen_h int, referrer text,
    utm_source text, utm_medium text, utm_campaign text,
    landing_path text, exit_path text,
    has_replay boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hm_sessions_site_time on hm_sessions(site_id, started_at desc)`,

  `create table if not exists hm_pageviews (
    id uuid primary key,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    site_id uuid not null references hm_sites(id) on delete cascade,
    seq int not null default 1, url text, path text not null, title text,
    ts timestamptz not null, device text,
    vw int, vh int, doc_h int,
    max_scroll_px int not null default 0, duration_ms int not null default 0,
    active_ms int not null default 0, clicks int not null default 0
  )`,
  `create index if not exists hm_pageviews_session on hm_pageviews(session_id, seq)`,
  `create index if not exists hm_pageviews_site_path on hm_pageviews(site_id, path, ts desc)`,

  `create table if not exists hm_events (
    id bigint generated always as identity primary key,
    site_id uuid not null references hm_sites(id) on delete cascade,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    pageview_id uuid, path text, device text,
    type text not null, ts timestamptz not null,
    x int, y int, w int, sel text, ox real, oy real, txt text, val int, meta jsonb
  )`,
  `create index if not exists hm_events_pv_type on hm_events(pageview_id, type)`,
  `create index if not exists hm_events_session on hm_events(session_id, ts)`,
  `create index if not exists hm_events_site_type_time on hm_events(site_id, type, ts)`,

  `create table if not exists hm_replay (
    id bigint generated always as identity primary key,
    site_id uuid not null references hm_sites(id) on delete cascade,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    pageview_id uuid, seq int not null default 0, ts timestamptz not null,
    has_snapshot boolean not null default false,
    enc text not null default 'gz', size int not null default 0,
    blob_key text not null
  )`,
  `create index if not exists hm_replay_session on hm_replay(session_id, ts, seq)`,
  `create index if not exists hm_replay_pv on hm_replay(pageview_id, seq)`,
  `create index if not exists hm_replay_site_time on hm_replay(site_id, ts)`,

  // Rótulo de página: agrupamentos de URLs (ex.: todos os /produto/... como "Produto")
  `create or replace function hm_label(p_site uuid, p_path text)
   returns text language plpgsql stable as $f$
   declare v text;
   begin
     select g.name into v from hm_page_groups g
      where g.site_id = p_site and (
           (g.match_type = 'exact'    and p_path = g.pattern)
        or (g.match_type = 'prefix'   and left(p_path, length(g.pattern)) = g.pattern)
        or (g.match_type = 'contains' and position(g.pattern in p_path) > 0)
        or (g.match_type = 'regex'    and p_path ~ g.pattern))
      order by g.position, g.id limit 1;
     return coalesce(v, p_path);
   exception when others then
     return p_path;
   end $f$`,

  // Progresso no funil: quantos passos (em ordem) a sequência de páginas cumpre
  `create or replace function hm_funnel_level(p_labels text[], p_steps text[])
   returns int language plpgsql immutable as $f$
   declare i int := 1; l text; n int := coalesce(array_length(p_steps, 1), 0);
   begin
     if p_labels is null then return 0; end if;
     foreach l in array p_labels loop
       exit when i > n;
       if l = p_steps[i] then i := i + 1; end if;
     end loop;
     return i - 1;
   end $f$`,

  // Ingestão de um lote enviado pelo script (1 round-trip por lote)
  `create or replace function hm_ingest(p jsonb, p_site uuid)
   returns jsonb language plpgsql as $f$
   declare
     s jsonb := p->'s';
     v_sid uuid := (s->>'id')::uuid;
     v_dev text := left(s->>'dev', 10);
     v_now timestamptz;
     n_click int; n_rage int; n_dead int; n_err int; v_replay boolean;
   begin
     -- relógio do cliente, limitado a +-1 dia do servidor
     v_now := to_timestamp(coalesce((s->>'now')::bigint, (extract(epoch from now()) * 1000)::bigint) / 1000.0);
     if abs(extract(epoch from (v_now - now()))) > 86400 then v_now := now(); end if;

     insert into hm_sessions (id, site_id, visitor_id, is_new, started_at, ended_at, device, browser, os,
          lang, tz, screen_w, screen_h, referrer, utm_source, utm_medium, utm_campaign, landing_path)
     values (v_sid, p_site, left(s->>'vid', 64), coalesce((s->>'new')::boolean, true),
          least(v_now, to_timestamp((s->>'ts')::bigint / 1000.0)), v_now, v_dev, left(s->>'br', 40), left(s->>'os', 40),
          left(s->>'lang', 20), left(s->>'tz', 60), (s->>'sw')::int, (s->>'sh')::int, left(s->>'ref', 500),
          left(s->'utm'->>'s', 100), left(s->'utm'->>'m', 100), left(s->'utm'->>'c', 150), left(s->>'lp', 500))
     on conflict (id) do nothing;

     if not exists (select 1 from hm_sessions where id = v_sid and site_id = p_site) then
       return jsonb_build_object('ok', false, 'err', 'session');
     end if;

     insert into hm_pageviews as pv (id, session_id, site_id, seq, url, path, title, ts, device, vw, vh, doc_h,
          max_scroll_px, duration_ms, active_ms, clicks)
     select (x->>'id')::uuid, v_sid, p_site, coalesce((x->>'seq')::int, 1), left(x->>'url', 2000),
            left(coalesce(nullif(x->>'path', ''), '/'), 500), left(x->>'title', 300),
            to_timestamp((x->>'ts')::bigint / 1000.0), v_dev,
            (x->>'vw')::int, (x->>'vh')::int, (x->>'dh')::int, coalesce((x->>'ms')::int, 0),
            least(coalesce((x->>'dur')::int, 0), 21600000), coalesce((x->>'act')::int, 0), coalesce((x->>'cl')::int, 0)
       from jsonb_array_elements(coalesce(p->'p', '[]'::jsonb)) x
     on conflict (id) do update set
            doc_h         = greatest(pv.doc_h, excluded.doc_h),
            max_scroll_px = greatest(pv.max_scroll_px, excluded.max_scroll_px),
            duration_ms   = greatest(pv.duration_ms, excluded.duration_ms),
            active_ms     = greatest(pv.active_ms, excluded.active_ms),
            clicks        = greatest(pv.clicks, excluded.clicks),
            title         = coalesce(excluded.title, pv.title)
      where pv.session_id = v_sid;

     with ins as (
       insert into hm_events (site_id, session_id, pageview_id, path, device, type, ts, x, y, w, sel, ox, oy, txt, val, meta)
       select p_site, v_sid, (e->>'pv')::uuid, left(e->>'path', 500), v_dev, e->>'t',
              to_timestamp((e->>'ts')::bigint / 1000.0), (e->>'x')::int, (e->>'y')::int, (e->>'w')::int,
              left(e->>'sel', 600), (e->>'ox')::real, (e->>'oy')::real, left(e->>'txt', 300), (e->>'v')::int, e->'m'
         from (select e from jsonb_array_elements(coalesce(p->'e', '[]'::jsonb)) e limit 3000) q
        where e->>'t' in ('click','rage','dead','move','hover','error')
       returning type
     )
     select count(*) filter (where type = 'click'), count(*) filter (where type = 'rage'),
            count(*) filter (where type = 'dead'),  count(*) filter (where type = 'error')
       into n_click, n_rage, n_dead, n_err from ins;

     with ins as (
       insert into hm_replay (site_id, session_id, pageview_id, seq, ts, has_snapshot, enc, size, blob_key)
       select p_site, v_sid, (r->>'pv')::uuid, coalesce((r->>'seq')::int, 0), to_timestamp((r->>'ts')::bigint / 1000.0),
              coalesce((r->>'snap')::boolean, false), case when r->>'enc' = 'raw' then 'raw' else 'gz' end,
              coalesce((r->>'size')::int, 0), r->>'key'
         from jsonb_array_elements(coalesce(p->'r', '[]'::jsonb)) r
        where r->>'key' is not null
       returning 1
     )
     select count(*) > 0 into v_replay from ins;

     update hm_sessions ss set
            ended_at     = greatest(ss.ended_at, v_now),
            duration_ms  = least((extract(epoch from (greatest(ss.ended_at, v_now) - ss.started_at)) * 1000)::bigint, 2000000000)::int,
            pageviews    = (select count(*) from hm_pageviews where session_id = v_sid),
            visible_ms   = (select coalesce(sum(duration_ms), 0) from hm_pageviews where session_id = v_sid),
            exit_path    = coalesce((select path from hm_pageviews where session_id = v_sid order by seq desc limit 1), ss.exit_path),
            landing_path = coalesce((select path from hm_pageviews where session_id = v_sid order by seq limit 1), ss.landing_path),
            clicks       = ss.clicks + n_click,
            rage_clicks  = ss.rage_clicks + n_rage,
            dead_clicks  = ss.dead_clicks + n_dead,
            errors       = ss.errors + n_err,
            has_replay   = ss.has_replay or v_replay
      where ss.id = v_sid;

     return jsonb_build_object('ok', true);
   end $f$`,

  // Processa vários lotes de uma vez (fila do Blobs -> banco); um lote ruim não derruba os outros
  `create or replace function hm_ingest_many(p jsonb)
   returns jsonb language plpgsql as $f$
   declare item jsonb; n_ok int := 0; n_bad int := 0;
   begin
     for item in select x from jsonb_array_elements(p) x loop
       begin
         perform hm_ingest(item->'p', (item->>'site')::uuid);
         n_ok := n_ok + 1;
       exception when others then
         n_bad := n_bad + 1;
         raise warning 'hm_ingest falhou: %', sqlerrm;
       end;
     end loop;
     return jsonb_build_object('ok', n_ok, 'failed', n_bad);
   end $f$`,

  // v2: conversão (clique em link de saída, ex.: ticketeria)
  `alter table hm_sessions add column if not exists visible_ms int not null default 0`,
  `alter table hm_sites add column if not exists goal text not null default ''`,
  `alter table hm_sites add column if not exists goal_label text not null default 'Clicou no link de conversão'`,
  `create or replace function hm_is_goal(m jsonb, goal text)
   returns boolean language sql immutable as $f$
   select case
     when m is null or m->>'href' is null then false
     when coalesce(trim(goal), '') = '' then coalesce(m->>'out', '') = '1'
     else exists (select 1 from unnest(string_to_array(goal, ',')) p
                  where trim(p) <> '' and (m->>'href') ilike '%' || trim(p) || '%')
   end
   $f$`,
  `create index if not exists hm_events_session_click on hm_events(session_id) where type = 'click' and meta ? 'href'`,
];
