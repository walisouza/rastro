-- duração da sessão = tempo com a aba visível (coluna nova; nada é apagado)

alter table hm_sessions add column if not exists visible_ms int not null default 0;

update hm_sessions ss set visible_ms = x.v from (select session_id, coalesce(sum(duration_ms),0)::int v from hm_pageviews group by 1) x where x.session_id = ss.id and ss.visible_ms = 0;

create or replace function hm_ingest(p jsonb, p_site uuid)
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
   end $f$;

