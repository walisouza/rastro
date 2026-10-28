var ve=Object.create;var te=Object.defineProperty;var ye=Object.getOwnPropertyDescriptor;var be=Object.getOwnPropertyNames;var xe=Object.getPrototypeOf,$e=Object.prototype.hasOwnProperty;var D=(e,t)=>()=>{try{return t||e((t={exports:{}}).exports,t),t.exports}catch(s){throw t=0,s}};var ke=(e,t,s,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of be(t))!$e.call(e,n)&&n!==s&&te(e,n,{get:()=>t[n],enumerable:!(i=ye(t,n))||i.enumerable});return e};var P=(e,t,s)=>(s=e!=null?ve(xe(e)):{},ke(t||!e||!e.__esModule?te(s,"default",{value:e,enumerable:!0}):s,e));var ne=D(()=>{throw new Error("indispon\xEDvel na Edge Function: npm:postgres@3.4.5")});var ie=D(()=>{throw new Error("indispon\xEDvel na Edge Function: pg")});var ae=D(()=>{throw new Error("indispon\xEDvel na Edge Function: @netlify/database")});var oe=D(()=>{throw new Error("indispon\xEDvel na Edge Function: @neondatabase/serverless")});var ce=D(()=>{throw new Error("indispon\xEDvel na Edge Function: @netlify/blobs")});import{createHmac as je,createHash as Te,timingSafeEqual as X,randomBytes as G}from"node:crypto";import{Buffer as x}from"node:buffer";var se=["create table if not exists hm_meta (k text primary key, v text)",`create table if not exists hm_sites (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    domains       text[] not null default '{}',
    site_key      text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    replay_sample real not null default 1 check (replay_sample between 0 and 1),
    mask_text     boolean not null default false,
    replay_days   int not null default 30 check (replay_days between 1 and 365),
    data_days     int not null default 180 check (data_days between 7 and 730),
    created_at    timestamptz not null default now()
  )`,`create table if not exists hm_page_groups (
    id          bigint generated always as identity primary key,
    site_id     uuid not null references hm_sites(id) on delete cascade,
    name        text not null,
    match_type  text not null default 'prefix' check (match_type in ('exact','prefix','contains','regex')),
    pattern     text not null,
    position    int not null default 0
  )`,"create index if not exists hm_page_groups_site on hm_page_groups(site_id, position)",`create table if not exists hm_sessions (
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
  )`,"create index if not exists hm_sessions_site_time on hm_sessions(site_id, started_at desc)",`create table if not exists hm_pageviews (
    id uuid primary key,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    site_id uuid not null references hm_sites(id) on delete cascade,
    seq int not null default 1, url text, path text not null, title text,
    ts timestamptz not null, device text,
    vw int, vh int, doc_h int,
    max_scroll_px int not null default 0, duration_ms int not null default 0,
    active_ms int not null default 0, clicks int not null default 0
  )`,"create index if not exists hm_pageviews_session on hm_pageviews(session_id, seq)","create index if not exists hm_pageviews_site_path on hm_pageviews(site_id, path, ts desc)",`create table if not exists hm_events (
    id bigint generated always as identity primary key,
    site_id uuid not null references hm_sites(id) on delete cascade,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    pageview_id uuid, path text, device text,
    type text not null, ts timestamptz not null,
    x int, y int, w int, sel text, ox real, oy real, txt text, val int, meta jsonb
  )`,"create index if not exists hm_events_pv_type on hm_events(pageview_id, type)","create index if not exists hm_events_session on hm_events(session_id, ts)","create index if not exists hm_events_site_type_time on hm_events(site_id, type, ts)",`create table if not exists hm_replay (
    id bigint generated always as identity primary key,
    site_id uuid not null references hm_sites(id) on delete cascade,
    session_id uuid not null references hm_sessions(id) on delete cascade,
    pageview_id uuid, seq int not null default 0, ts timestamptz not null,
    has_snapshot boolean not null default false,
    enc text not null default 'gz', size int not null default 0,
    blob_key text not null
  )`,"create index if not exists hm_replay_session on hm_replay(session_id, ts, seq)","create index if not exists hm_replay_pv on hm_replay(pageview_id, seq)","create index if not exists hm_replay_site_time on hm_replay(site_id, ts)",`create or replace function hm_label(p_site uuid, p_path text)
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
   end $f$`,`create or replace function hm_funnel_level(p_labels text[], p_steps text[])
   returns int language plpgsql immutable as $f$
   declare i int := 1; l text; n int := coalesce(array_length(p_steps, 1), 0);
   begin
     if p_labels is null then return 0; end if;
     foreach l in array p_labels loop
       exit when i > n;
       if l = p_steps[i] then i := i + 1; end if;
     end loop;
     return i - 1;
   end $f$`,`create or replace function hm_ingest(p jsonb, p_site uuid)
   returns jsonb language plpgsql as $f$
   declare
     s jsonb := p->'s';
     v_sid uuid := (s->>'id')::uuid;
     v_dev text := left(s->>'dev', 10);
     v_now timestamptz;
     n_click int; n_rage int; n_dead int; n_err int; v_replay boolean;
   begin
     -- rel\xF3gio do cliente, limitado a +-1 dia do servidor
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
   end $f$`,`create or replace function hm_ingest_many(p jsonb)
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
   end $f$`,"alter table hm_sessions add column if not exists visible_ms int not null default 0","alter table hm_sites add column if not exists goal text not null default ''","alter table hm_sites add column if not exists goal_label text not null default 'Clicou no link de convers\xE3o'",`create or replace function hm_is_goal(m jsonb, goal text)
   returns boolean language sql immutable as $f$
   select case
     when m is null or m->>'href' is null then false
     when coalesce(trim(goal), '') = '' then coalesce(m->>'out', '') = '1'
     else exists (select 1 from unnest(string_to_array(goal, ',')) p
                  where trim(p) <> '' and (m->>'href') ilike '%' || trim(p) || '%')
   end
   $f$`,"create index if not exists hm_events_session_click on hm_events(session_id) where type = 'click' and meta ? 'href'"];var M=e=>globalThis.Netlify?.env?.get?.(e)??globalThis.Deno?.env?.get?.(e)??globalThis.process?.env?.[e],Se=e=>"{"+e.map(t=>t==null?"NULL":'"'+String(t).replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"').join(",")+"}",v=null,R=null,b=null;async function le(){if(v)return v;if(globalThis.__HM_TEST_DB){let s=globalThis.__HM_TEST_DB;return b="pglite",v=async(i,n=[])=>(await s.query(i,n)).rows,v}let e=M("DATABASE_URL"),t=M("SUPABASE_DB_URL");if(globalThis.Deno&&(e||t)){let i=(globalThis.__RASTRO_POSTGRES||(await Promise.resolve().then(()=>P(ne(),1))).default)(e||t,{max:Number(M("RASTRO_PG_MAX"))||2,prepare:!1,idle_timeout:20,connect_timeout:10});return b="supabase",v=async(n,a=[])=>{let o=new Set([...n.matchAll(/\$(\d+)::jsonb/g)].map(c=>+c[1]-1)),l=a.map((c,h)=>Array.isArray(c)?Se(c):o.has(h)&&typeof c=="string"?JSON.parse(c):c);return[...await i.unsafe(n,l)]},v}if(e){let{default:s}=await Promise.resolve().then(()=>P(ie(),1)),i=new s.Pool({connectionString:e,max:3,idleTimeoutMillis:1e4,ssl:/sslmode=disable|localhost|127\.0\.0\.1/.test(e)?!1:{rejectUnauthorized:!1}});return b="postgres",v=async(n,a=[])=>(await i.query(n,a)).rows,v}try{let{getDatabase:s}=await Promise.resolve().then(()=>P(ae(),1)),i=s();return b="netlify-database",v=async(n,a=[])=>(await i.pool.query(n,a)).rows,v}catch{let i=M("NETLIFY_DATABASE_URL");if(i){let{neon:a}=await Promise.resolve().then(()=>P(oe(),1)),o=a(i);return b="netlify-db-legacy",v=(l,c=[])=>o.query(l,c),v}let n=new Error("Banco de dados n\xE3o configurado. Crie um em Netlify > Data & Storage > Database, ou defina a vari\xE1vel DATABASE_URL com um Postgres (ex.: Supabase).");throw n.code="NO_DB",n}}async function r(e,t=[]){return await Ee(),(await le())(e,t)}async function _(e,t=[]){return(await r(e,t))[0]||null}function Ee(){return R||(R=(async()=>{let e=await le();if(b==="netlify-database"||b==="supabase")return;let t=0;try{let s=await e("select v from hm_meta where k = 'schema'");t=s.length?Number(s[0].v):0}catch{t=0}if(!(t>=2)){for(let s of se)await e(s);await e("insert into hm_meta (k, v) values ('schema', $1) on conflict (k) do update set v = excluded.v",[String(2)])}})().catch(e=>{throw R=null,e})),R}var C=new Map,H=e=>globalThis.Deno?.env?.get?.(e);function de(e){let t=H("SUPABASE_URL")+"/storage/v1/object",s=H("SUPABASE_SERVICE_ROLE_KEY"),i=(a={})=>({authorization:"Bearer "+s,apikey:s,...a}),n=a=>a.split("/").map(encodeURIComponent).join("/");return{set:async(a,o)=>{let l=await fetch(`${t}/${e}/${n(a)}`,{method:"POST",headers:i({"content-type":"application/octet-stream","x-upsert":"true"}),body:o});if(!l.ok)throw new Error("storage set "+l.status+" "+(await l.text()).slice(0,200))},get:async(a,o)=>{let l=await fetch(`${t}/${e}/${n(a)}`,{headers:i()});if(l.status===404||l.status===400)return null;if(!l.ok)throw new Error("storage get "+l.status);return o==="text"?l.text():new Uint8Array(await l.arrayBuffer())},delete:async a=>de(e).deleteMany([a]),deleteMany:async a=>{for(let o=0;o<a.length;o+=100)await fetch(`${t}/${e}`,{method:"DELETE",headers:i({"content-type":"application/json"}),body:JSON.stringify({prefixes:a.slice(o,o+100)})})},list:async()=>[]}}function J(e){if(C.has(e))return C.get(e);let t;if(globalThis.Deno&&H("SUPABASE_URL"))t=de(e);else if(globalThis.__HM_TEST_BLOBS){let s=globalThis.__HM_TEST_BLOBS;s.has(e)||s.set(e,new Map);let i=s.get(e);t={set:async(n,a)=>{i.set(n,typeof a=="string"?a:Buffer.from(a))},get:async(n,a)=>{if(!i.has(n))return null;let o=i.get(n);return a==="text"?String(o):Buffer.from(o)},delete:async n=>{i.delete(n)},list:async(n="")=>[...i.keys()].filter(a=>a.startsWith(n)).sort()}}else{let s=null,i=async()=>{if(!s){let{getStore:n}=await Promise.resolve().then(()=>P(ce(),1));s=n({name:e,consistency:e==="rastro-replay"?"eventual":"strong"})}return s};t={set:async(n,a)=>(await i()).set(n,typeof a=="string"?a:new Blob([a])),get:async(n,a)=>{let o=await i();if(a==="text")return o.get(n,{type:"text"});let l=await o.get(n,{type:"arrayBuffer"});return l?Buffer.from(l):null},delete:async n=>(await i()).delete(n),list:async(n="")=>(await(await i()).list(n?{prefix:n}:{})).blobs.map(o=>o.key).sort()}}return C.set(e,t),t}var N=()=>J("rastro-replay"),z=()=>J("rastro-inbox"),O=()=>J("rastro-meta");async function B(e,t,s=null){try{let i=await e.get(t,"text");return i?JSON.parse(i):s}catch{return s}}async function F(e,t,s){return e.set(t,JSON.stringify(s))}var j=e=>globalThis.Netlify?.env?.get?.(e)??globalThis.Deno?.env?.get?.(e)??globalThis.process?.env?.[e],A=()=>!!globalThis.Deno||j("HM_DIRECT")==="1",f={"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type, authorization, x-rastro-key","access-control-max-age":"86400"},d=(e,t=200,s={})=>new Response(JSON.stringify(e),{status:t,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...s}}),u=(e,t=400,s={})=>d({error:e},t,s),g=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,$={pw:null,secret:""},ue=0,L=e=>Te("sha256").update(String(e)).digest("hex");async function K(){if(j("HM_PASSWORD"))return $={pw:L(j("HM_PASSWORD")),secret:j("HM_SECRET")||j("HM_PASSWORD")},$;if(Date.now()-ue<3e5)return $;try{let e=await r("select k, v from hm_meta where k in ('auth_pw_sha256', 'auth_secret')"),t=Object.fromEntries(e.map(s=>[s.k,s.v]));$={pw:t.auth_pw_sha256||null,secret:t.auth_secret||t.auth_pw_sha256||""},ue=Date.now()}catch{}return $}function Z(){return $.secret||""}function he(e){return je("sha256",Z()).update(e).digest("base64url")}function De(e=30){let t=x.from(JSON.stringify({exp:Date.now()+e*864e5,n:G(6).toString("hex")})).toString("base64url");return t+"."+he(t)}function Pe(e){if(!e||!Z())return!1;let[t,s]=e.split(".");if(!t||!s)return!1;let i=x.from(he(t)),n=x.from(s);if(i.length!==n.length||!X(i,n))return!1;try{return JSON.parse(x.from(t,"base64url").toString()).exp>Date.now()}catch{return!1}}function Oe(e){let t=e.headers.get("authorization")||"";return Pe(t.replace(/^Bearer\s+/i,""))}var E=null,W=0;async function q(){if(A())return E=null,V.clear(),{};let e=await r("select id, site_key, domains, replay_sample, mask_text from hm_sites"),t=Object.fromEntries(e.map(s=>[s.site_key,{id:s.id,domains:s.domains,replay_sample:s.replay_sample,mask_text:s.mask_text}]));return await F(O(),"sites",t),E=t,W=Date.now(),t}var V=new Map;async function fe(e){if(A()){let t=V.get(e);if(t&&Date.now()-t.t<6e4)return t.site;let s=await _("select id, domains, replay_sample, mask_text from hm_sites where site_key = $1",[e]);return V.set(e,{site:s,t:Date.now()}),s}return(!E||Date.now()-W>6e4)&&(E=await B(O(),"sites",null),W=Date.now(),E||(E=await q().catch(()=>({})))),E[e]||null}function Ae(e,t){let s=(e.domains||[]).map(a=>a.trim().toLowerCase()).filter(Boolean);if(!s.length)return!0;let i=t.headers.get("origin")||t.headers.get("referer")||"",n="";try{n=new URL(i).hostname.toLowerCase()}catch{return!1}return s.some(a=>n===a||n.endsWith("."+a))}async function Me(e){let t=await e.text();if(t.length>55e5)return u("payload too large",413,f);let s;try{s=JSON.parse(t)}catch{return u("bad json",400,f)}if(!s||typeof s.k!="string"||!s.s||!g.test(s.s.id||""))return u("bad payload",400,f);let i=await fe(s.k);if(!i)return u("unknown site",404,f);if(!Ae(i,e))return u("origin not allowed",403,f);let n=Array.isArray(s.r)?s.r.slice(0,20):[];s.r=[];for(let o of n){if(!o||typeof o.d!="string"||!g.test(o.pv||""))continue;let l=x.from(o.d,"base64");if(!l.length||l.length>5e6)continue;let c=`${i.id}/${s.s.id}/${Date.now()}-${o.seq|0}-${G(3).toString("hex")}`;await N().set(c,l),s.r.push({pv:o.pv,seq:o.seq|0,ts:o.ts,snap:!!o.snap,enc:o.enc==="raw"?"raw":"gz",size:l.length,key:c})}if(s.p=(Array.isArray(s.p)?s.p:[]).filter(o=>o&&g.test(o.id||"")).slice(0,5),s.e=(Array.isArray(s.e)?s.e:[]).filter(o=>o&&(!o.pv||g.test(o.pv))).slice(0,3e3),!s.p.length&&!s.e.length&&!s.r.length)return d({ok:!0},200,f);if(A())return await _("select hm_ingest($1::jsonb, $2::uuid) as r",[JSON.stringify(s),i.id]),Ve(),d({ok:!0},202,f);let a=`${String(Date.now()).padStart(15,"0")}-${G(4).toString("hex")}`;return await z().set(a,JSON.stringify({site:i.id,p:s})),d({ok:!0},202,f)}var Re=150;async function Ne(e=8e3){let t=Date.now(),s=z(),i=await s.list(),n=0,a=0,o=0;for(;o<i.length&&Date.now()-t<e;){let c=i.slice(o,o+Re);o+=c.length;let h=[];for(let p=0;p<c.length;p+=25){let y=await Promise.all(c.slice(p,p+25).map(T=>B(s,T,null)));h.push(...y)}let w=h.filter(p=>p&&p.site&&p.p);if(w.length){let p=await _("select hm_ingest_many($1::jsonb) as r",[JSON.stringify(w)]);n+=p?.r?.ok||0,a+=p?.r?.failed||0}for(let p=0;p<c.length;p+=25)await Promise.all(c.slice(p,p+25).map(y=>s.delete(y)))}let l=new Date().toISOString();return await F(O(),"last_flush",{at:l,processed:n,failed:a}),{processed:n,failed:a,remaining:i.length-o,at:l}}async function ze(e){let t=await fe(e.searchParams.get("k")||"");return t?d({rs:t.replay_sample,mt:t.mask_text},200,{...f,"cache-control":"public, max-age=300"}):u("unknown site",404,f)}function S(e){let t=e.searchParams.get("site");if(!g.test(t||""))throw new k(400,"site inv\xE1lido");let s=e.searchParams.get("to")?new Date(e.searchParams.get("to")):new Date,i=e.searchParams.get("from")?new Date(e.searchParams.get("from")):new Date(s-30*864e5);if(isNaN(i)||isNaN(s))throw new k(400,"datas inv\xE1lidas");let n=["desktop","tablet","mobile"].includes(e.searchParams.get("device"))?e.searchParams.get("device"):null,a=e.searchParams.get("grouped")==="1",o=e.searchParams.get("tz")||"America/Sao_Paulo";return{site:t,from:i.toISOString(),to:s.toISOString(),device:n,grouped:a,tz:o,span:s-i}}var k=class extends Error{constructor(t,s){super(s),this.status=t}},m=`s as (select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv
  from hm_sessions ss join hm_sites st on st.id = ss.site_id
  where ss.site_id = $1 and ss.started_at >= $2 and ss.started_at < $3 and ($4::text is null or ss.device = $4))`,ee=e=>e?"hm_label($1, pv.path)":"pv.path",Q=`with ${m}
  select count(*)::int sessions, count(distinct visitor_id)::int visitors, coalesce(sum(pageviews),0)::int pageviews,
    avg((pageviews <= 1 and not conv)::int)::float bounce, avg(visible_ms)::float avg_duration, avg(pageviews)::float pps,
    avg(conv::int)::float conversion, count(*) filter (where conv)::int conversions,
    avg((rage_clicks > 0)::int)::float rage, avg((dead_clicks > 0)::int)::float dead, avg((errors > 0)::int)::float errors,
    avg(is_new::int)::float new_visitors, count(*) filter (where has_replay)::int replays,
    (select avg(least(100, pv.max_scroll_px * 100.0 / nullif(pv.doc_h, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float scroll,
    (select avg(least(1, pv.active_ms * 1.0 / nullif(pv.duration_ms, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float activity
  from s`;async function Be(e){let t=S(e),s=[t.site,t.from,t.to,t.device],i=new Date(new Date(t.from)-t.span).toISOString(),n=t.span<=2.1*864e5?"hour":"day",a=Q,[o,l,c,h,w,p,y,T,U]=await Promise.all([_(a,s),_(a,[t.site,i,t.from,t.device]),r(`with ${m}, b as (
        select generate_series(date_trunc('${n}', $2::timestamptz at time zone $5), date_trunc('${n}', $3::timestamptz at time zone $5), interval '1 ${n}') b)
       select to_char(b.b, 'YYYY-MM-DD"T"HH24:MI') b, count(s.id)::int sessions, coalesce(sum(s.pageviews),0)::int pageviews,
         count(s.id) filter (where s.conv)::int converted,
         count(s.id) filter (where s.rage_clicks > 0 or s.dead_clicks > 0 or s.errors > 0)::int frustrated
       from b left join s on date_trunc('${n}', s.started_at at time zone $5) = b.b group by b.b order by b.b`,[...s,t.tz]),r(`with ${m} select coalesce(device,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(visible_ms)::float dur from s group by 1 order by 2 desc`,s),r(`with ${m}, c as (select *, case
          when coalesce(utm_medium,'') ~* '(cpc|ppc|paid|ads)' then 'M\xEDdia paga'
          when coalesce(utm_medium,'') ~* 'email' then 'E-mail'
          when coalesce(utm_source,'') <> '' and coalesce(utm_medium,'') ~* 'social' then 'Social'
          when coalesce(utm_source,'') <> '' then 'Campanha (UTM)'
          when coalesce(referrer,'') = '' then 'Direto'
          when referrer ~* '(google|bing|yahoo|duckduckgo|ecosia|yandex)\\.' then 'Busca org\xE2nica'
          when referrer ~* '(facebook|instagram|t\\.co|twitter|x\\.com|linkedin|tiktok|youtube|pinterest|whatsapp|threads)' then 'Social'
          else 'Refer\xEAncia' end ch from s)
        select ch k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv from c group by 1 order by 2 desc`,s),r(`with ${m} select coalesce(nullif(substring(referrer from '^[a-z]+://([^/:]+)'),''), '(direto)') k, count(*)::int n
       from s group by 1 order by 2 desc limit 10`,s),r(`with ${m} select coalesce(landing_path,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(visible_ms)::float dur
       from s group by 1 order by 2 desc limit 10`,s),r(`with ${m} select e.txt k, count(*)::int n, count(distinct e.session_id)::int sessions, max(e.path) path
       from hm_events e join s on s.id = e.session_id where e.site_id = $1 and e.type = 'error' group by 1 order by 3 desc limit 10`,s),r(`with ${m} select coalesce(browser,'?') || ' \xB7 ' || coalesce(os,'?') k, count(*)::int n from s group by 1 order by 2 desc limit 8`,s)]);return d({kpis:o,prev:l,bucket:n,series:c,devices:h,channels:w,refs:p,landings:y,errors:T,browsers:U})}async function qe(e){let t=S(e),s=await r(`with ${m},
    pv as (
      select pv.*, s.conv, ${ee(t.grouped)} label,
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
    group by label order by views desc limit 500`,[t.site,t.from,t.to,t.device]);return d({rows:s})}async function Le(e){let t=S(e),s=e.searchParams.get("page")||"/",i=t.device||"desktop",n=[t.site,t.from,t.to,i,s],a=`${m}, pvs as (
      select pv.* from hm_pageviews pv join s on s.id = pv.session_id
      where pv.site_id = $1 and ${t.grouped?"hm_label($1, pv.path)":"pv.path"} = $5)`,[o,l,c,h,w,p,y,T]=await Promise.all([_(`with ${a} select count(*)::int pageviews, count(distinct session_id)::int sessions,
          percentile_disc(0.5) within group (order by vw) vw, avg(vh)::int vh, avg(doc_h)::int doc_h,
          avg(duration_ms)::float avg_time, avg(clicks)::float clicks
         from pvs`,n),r(`with ${a} select least(100, round(greatest(max_scroll_px, vh) * 100.0 / nullif(doc_h, 0)))::int r from pvs where doc_h > 0 limit 20000`,n),r(`with ${a} select e.sel, e.ox, e.oy, e.x, e.y, e.w from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' order by e.id desc limit 40000`,n),r(`with ${a} select e.type, e.sel, e.ox, e.oy, e.x, e.y, e.w, e.txt from hm_events e join pvs on pvs.id = e.pageview_id where e.type in ('rage','dead') order by e.id desc limit 10000`,n),r(`with ${a} select e.x, e.y, e.w, sum(e.val)::int v from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'move' group by 1,2,3 order by 4 desc limit 40000`,n),r(`with ${a} select e.sel, count(*)::int clicks, count(distinct e.pageview_id)::int pv, max(e.txt) txt,
          min(e.y) y
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' group by 1 order by 2 desc limit 2000`,n),r(`with ${a} select e.sel, sum(e.val)::bigint ms, count(distinct e.pageview_id)::int pv, max(e.txt) txt
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'hover' group by 1 order by 2 desc limit 2000`,n),r(`with ${a} select r.pageview_id pv, pvs.vw, pvs.vh, pvs.doc_h, pvs.url, r.ts
         from hm_replay r join pvs on pvs.id = r.pageview_id where r.has_snapshot order by r.ts desc limit 8`,n)]);return d({device:i,page:s,summary:o,reach:l.map(U=>U.r),clicks:c,frust:h,moves:w,zones:p,hovers:y,snaps:T})}async function Ie(e){let t=e.searchParams.get("pv");if(!g.test(t||""))return u("pv inv\xE1lido");let s=await r("select blob_key key, enc, seq, ts from hm_replay where pageview_id = $1 order by seq, ts limit 12",[t]);return d({chunks:s})}async function Ue(e){let t=S(e),s=e.searchParams,i=[t.site,t.from,t.to,t.device],n=[],a=(p,y)=>{i.push(y),n.push(p.replaceAll("$?","$"+i.length))};s.get("replay")==="1"&&n.push("s.has_replay"),s.get("frustration")==="1"&&n.push("(s.rage_clicks > 0 or s.dead_clicks > 0)"),s.get("rage")==="1"&&n.push("s.rage_clicks > 0"),s.get("errors")==="1"&&n.push("s.errors > 0"),s.get("bounce")==="1"&&n.push("(s.pageviews <= 1 and not s.conv)"),s.get("converted")==="1"&&n.push("s.conv"),s.get("notconverted")==="1"&&n.push("not s.conv"),s.get("new")==="1"&&n.push("s.is_new"),+s.get("min_dur")>0&&a("s.visible_ms >= $?",+s.get("min_dur")*1e3),s.get("page")&&a("exists (select 1 from hm_pageviews x where x.session_id = s.id and x.path ilike $?)","%"+s.get("page")+"%"),s.get("landing")&&a("s.landing_path ilike $?","%"+s.get("landing")+"%"),s.get("source")&&a("(s.utm_source ilike $? or s.referrer ilike $?)","%"+s.get("source")+"%"),s.get("visitor")&&a("s.visitor_id = $?",s.get("visitor")),s.get("ids")&&a("s.id = any($?::uuid[])",s.get("ids").split(",").filter(p=>g.test(p)));let o=Math.min(200,+s.get("limit")||50),l=Math.max(0,+s.get("offset")||0),c=n.length?" and "+n.join(" and "):"",[h,w]=await Promise.all([r(`with ${m} select s.id, s.visitor_id, s.started_at, s.visible_ms duration_ms, s.pageviews, s.device, s.browser, s.os,
          s.referrer, s.utm_source, s.utm_campaign, s.landing_path, s.exit_path, s.clicks, s.rage_clicks, s.dead_clicks,
          s.errors, s.is_new, s.has_replay, s.screen_w, s.screen_h, s.lang, s.conv,
          (select array_agg(path order by seq) from (select path, seq from hm_pageviews x where x.session_id = s.id order by seq limit 10) t) paths
        from s where true ${c} order by s.started_at desc limit ${o} offset ${l}`,i),_(`with ${m} select count(*)::int n from s where true ${c}`,i)]);return d({rows:h,total:w.n})}async function Ce(e){let t=e.searchParams.get("id");if(!g.test(t||""))return u("id inv\xE1lido");let[s,i,n,a]=await Promise.all([_(`select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv,
           st.goal, st.goal_label from hm_sessions ss join hm_sites st on st.id = ss.site_id where ss.id = $1`,[t]),r("select id, seq, url, path, title, ts, vw, vh, doc_h, max_scroll_px, duration_ms, active_ms, clicks from hm_pageviews where session_id = $1 order by seq",[t]),r("select type, ts, pageview_id pv, path, sel, txt, x, y, meta from hm_events where session_id = $1 and type in ('click','rage','dead','error') order by ts limit 3000",[t]),r("select blob_key key, enc, seq, ts, pageview_id pv, has_snapshot snap, size from hm_replay where session_id = $1 order by ts, seq, id",[t])]);return s?(s.wall_ms=s.duration_ms,s.duration_ms=s.visible_ms,d({session:s,pageviews:i,events:n,chunks:a})):u("sess\xE3o n\xE3o encontrada",404)}async function He(e){let t=e.searchParams.get("key")||"";if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w-]+$/i.test(t))return u("key inv\xE1lida");let s=await N().get(t);return s?new Response(s,{headers:{"content-type":"application/octet-stream","cache-control":"private, max-age=86400"}}):u("n\xE3o encontrado",404)}var ge=e=>`${m}, seqs as (
    select session_id, bool_or(conv) conv, array_agg(label order by seq) labels from (
      select pv.session_id, s.conv, pv.seq, l.label, lag(l.label) over (partition by pv.session_id order by pv.seq) prev
      from hm_pageviews pv join s on s.id = pv.session_id
      cross join lateral (select ${ee(e)} label) l
    ) t where prev is distinct from label group by session_id)`;async function Je(e){let t=S(e),s=Math.min(8,Math.max(2,+e.searchParams.get("depth")||5)),i=e.searchParams.get("start")||null,n=await r(`with ${ge(t.grouped)},
    trimmed as (
      select conv, case when $5::text is null then labels else labels[array_position(labels, $5::text):] end labels
      from seqs where $5::text is null or array_position(labels, $5::text) is not null)
    select labels[1:${s}] path, (cardinality(labels) > ${s}) more, conv, count(*)::int n
    from trimmed group by 1, 2, 3 order by 4 desc limit 5000`,[t.site,t.from,t.to,t.device,i]);return d({depth:s,rows:n})}async function Fe(e){let t=S(e),s=[];try{s=JSON.parse(e.searchParams.get("steps")||"[]").map(String).slice(0,12)}catch{}if(s.length<2)return u("informe pelo menos 2 etapas");if(s.slice(0,-1).includes("__goal__"))return u("a convers\xE3o precisa ser a \xFAltima etapa");let i=s[s.length-1]==="__goal__",n=i?s.slice(0,-1):s,[a,o]=await Promise.all([r(`with ${ge(t.grouped)} select hm_funnel_level(labels, $5::text[]) lvl, conv, count(*)::int n from seqs group by 1, 2`,[t.site,t.from,t.to,t.device,n]),_(`with ${m} select count(*)::int n from s`,[t.site,t.from,t.to,t.device])]),l=n.map((c,h)=>a.filter(w=>w.lvl>=h+1).reduce((w,p)=>w+p.n,0));return i&&l.push(a.filter(c=>c.lvl>=n.length&&c.conv).reduce((c,h)=>c+h.n,0)),d({steps:s,counts:l,total:o.n})}async function Ke(e){let t=S(e),s=await r(`with ${m} select ${ee(t.grouped)} label, count(*)::int n
    from hm_pageviews pv join s on s.id = pv.session_id group by 1 order by 2 desc limit 400`,[t.site,t.from,t.to,t.device]);return d({rows:s})}var Y="id, name, domains, site_key, replay_sample, mask_text, replay_days, data_days, goal, goal_label, created_at";function pe(e){let t=(Array.isArray(e.domains)?e.domains:String(e.domains||"").split(/[\s,]+/)).map(s=>String(s).trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/^www\./,"")).filter(Boolean).slice(0,20);return[String(e.name||"Novo site").slice(0,80),t,Math.min(1,Math.max(0,Number(e.replay_sample??1))),!!e.mask_text,Math.min(365,Math.max(1,parseInt(e.replay_days??30))),Math.min(730,Math.max(7,parseInt(e.data_days??180))),String(e.goal??"").slice(0,300),String(e.goal_label||"Clicou no link de convers\xE3o").slice(0,60)]}async function Ye(e,t,s){if(e.method==="GET")return d({rows:await r(`select ${Y},
      (select max(started_at) from hm_sessions x where x.site_id = hm_sites.id) last_seen
      from hm_sites order by created_at`)});if(e.method==="POST"){let i=await e.json(),n=await _(`insert into hm_sites (name, domains, replay_sample, mask_text, replay_days, data_days, goal, goal_label)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${Y}`,pe(i));return await q(),d(n)}if(!g.test(s||""))return u("id inv\xE1lido");if(e.method==="PUT"){let i=await e.json(),n=await _(`update hm_sites set name=$2, domains=$3, replay_sample=$4, mask_text=$5, replay_days=$6, data_days=$7, goal=$8, goal_label=$9
      where id=$1 returning ${Y}`,[s,...pe(i)]);return await q(),d(n)}if(e.method==="DELETE"){let i=await r("select blob_key from hm_replay where site_id = $1",[s]);return await I(i.map(n=>n.blob_key)),await r("delete from hm_sites where id = $1",[s]),await q(),d({ok:!0})}return u("m\xE9todo",405)}async function Ge(e,t,s){if(e.method==="GET"){let i=t.searchParams.get("site");return g.test(i||"")?d({rows:await r("select * from hm_page_groups where site_id = $1 order by position, id",[i])}):u("site inv\xE1lido")}if(e.method==="POST"){let i=await e.json();if(!g.test(i.site_id||"")||!i.name||!i.pattern)return u("campos obrigat\xF3rios");let n=["exact","prefix","contains","regex"].includes(i.match_type)?i.match_type:"prefix";return d(await _(`insert into hm_page_groups (site_id, name, match_type, pattern, position)
      values ($1,$2,$3,$4, coalesce((select max(position)+1 from hm_page_groups where site_id=$1),0)) returning *`,[i.site_id,String(i.name).slice(0,80),n,String(i.pattern).slice(0,300)]))}return e.method==="DELETE"&&/^\d+$/.test(s||"")?(await r("delete from hm_page_groups where id = $1",[s]),d({ok:!0})):u("m\xE9todo",405)}async function We(e){if(!g.test(e||""))return u("id inv\xE1lido");let t=await r("select blob_key from hm_replay where session_id = $1",[e]);return await I(t.map(s=>s.blob_key)),await r("delete from hm_sessions where id = $1",[e]),d({ok:!0})}var _e=0;function Ve(){if(Date.now()-_e<6*36e5)return;_e=Date.now();let e=(async()=>{let t=await _("select v from hm_meta where k = 'last_cleanup'");t&&Date.now()-new Date(t.v).getTime()<20*36e5||(await r("insert into hm_meta (k, v) values ('last_cleanup', $1) on conflict (k) do update set v = excluded.v",[new Date().toISOString()]),await we())})().catch(t=>console.error("cleanup",t));globalThis.EdgeRuntime?.waitUntil?.(e)}var I=async e=>{if(!e.length)return;let t=N();if(t.deleteMany)return t.deleteMany(e).catch(()=>{});for(let s of e)await t.delete(s).catch(()=>{})};async function we(){let e=await r(`select r.id, r.blob_key from hm_replay r join hm_sites s on s.id = r.site_id
                        where r.ts < now() - make_interval(days => s.replay_days) limit 5000`);await I(e.map(s=>s.blob_key)),e.length&&await r("delete from hm_replay where id = any($1::bigint[])",[e.map(s=>s.id)]),await r("update hm_sessions ss set has_replay = false where has_replay and not exists (select 1 from hm_replay r where r.session_id = ss.id)");let t=await r(`select r.blob_key from hm_replay r join hm_sessions ss on ss.id = r.session_id join hm_sites s on s.id = ss.site_id
                         where ss.started_at < now() - make_interval(days => s.data_days) limit 5000`);return await I(t.map(s=>s.blob_key)),await r("delete from hm_sessions ss using hm_sites s where ss.site_id = s.id and ss.started_at < now() - make_interval(days => s.data_days)"),{replays:e.length}}function Qe(e){let t=String(j("RASTRO_READ_KEY")||"").split(",").map(i=>i.trim()).filter(i=>i.length>=24);if(!t.length)throw new k(503,"API de leitura desativada (defina RASTRO_READ_KEY)");let s=x.from(L(e.headers.get("x-rastro-key")||""));return t.some(i=>{let n=x.from(L(i));return X(s,n)})}async function Xe(e){if(!e)throw new k(400,"informe ?site= (id ou nome do site)");let t=g.test(e)?await _("select id, name, domains from hm_sites where id = $1",[e]):await _("select id, name, domains from hm_sites where lower(name) = lower($1)",[e]);if(!t)throw new k(404,"site n\xE3o encontrado");return t}var me=e=>e&&{sessions:e.sessions,visitors:e.visitors,pageviews:e.pageviews,conversion:e.conversion,conversions:e.conversions,avg_duration_ms:e.avg_duration==null?null:Math.round(e.avg_duration),bounce:e.bounce,scroll_pct:e.scroll,activity:e.activity,rage_sessions:e.rage,error_sessions:e.errors,new_visitors:e.new_visitors,pages_per_session:e.pps};async function Ze(e,t,s){if(e.method!=="GET")return u("use GET",405);if(!Qe(e))return await new Promise(i=>setTimeout(i,400)),u("chave inv\xE1lida",401);if(s==="sites")return d({sites:await r("select id, name, domains from hm_sites order by name")});if(s==="overview"){let i=await Xe(t.searchParams.get("site"));t.searchParams.set("site",i.id);let n=S(t),a=new Date(new Date(n.from)-n.span).toISOString(),[o,l]=await Promise.all([_(Q,[n.site,n.from,n.to,n.device]),_(Q,[n.site,a,n.from,n.device])]),c=await _("select goal, goal_label from hm_sites where id = $1",[i.id]);return d({site:{id:i.id,name:i.name,domains:i.domains,goal:c?.goal||null,goal_label:c?.goal_label||null},period:{from:n.from,to:n.to,device:n.device||"all"},previous_period:{from:a,to:n.from},kpis:me(o),previous:me(l),generated_at:new Date().toISOString()})}return u("rota n\xE3o encontrada: use /stats/sites ou /stats/overview",404)}async function yt(e){let t=await et(e);for(let[s,i]of Object.entries(f))t.headers.has(s)||t.headers.set(s,i);return t}async function et(e){let t=new URL(e.url),s=t.pathname.replace(/^\/(\.netlify\/functions\/api|api|functions\/v1\/rastro|rastro)/,"").replace(/\/+$/,"")||"/",[,i,n]=s.split("/");try{if(e.method==="OPTIONS")return new Response(null,{status:204,headers:f});if(i==="collect"&&e.method==="POST")return await Me(e);if(i==="config")return await ze(t);if(i==="stats")return await Ze(e,t,n);if(i==="health")return await K(),d({ok:!0,auth:!!Z()});if(i==="login"&&e.method==="POST"){if(await K(),!$.pw)return u("Senha do painel n\xE3o configurada no servidor",503);let{password:a}=await e.json().catch(()=>({})),o=x.from(L(String(a||""))),l=x.from($.pw);return o.length!==l.length||!X(o,l)?(await new Promise(c=>setTimeout(c,600)),u("Senha incorreta",401)):d({token:De()})}if(await K(),!Oe(e))return u("n\xE3o autenticado",401);switch(i){case"sites":return await Ye(e,t,n);case"groups":return await Ge(e,t,n);case"overview":return await Be(t);case"pages":return await qe(t);case"heatmap":return await Le(t);case"snapshot":return await Ie(t);case"sessions":return await Ue(t);case"session":return e.method==="DELETE"?await We(n):await Ce(t);case"chunk":return await He(t);case"journey":return await Je(t);case"funnel":return await Fe(t);case"labels":return await Ke(t);case"cleanup":return d(await we());case"flush":return d(A()?{processed:0,failed:0,remaining:0,at:new Date().toISOString()}:await Ne(Math.min(2e4,+t.searchParams.get("budget")||7e3)));case"status":{if(A())return d({pending:0,oldest:null,last:{at:new Date().toISOString()},backend:"direto"});let[a,o]=await Promise.all([z().list(),B(O(),"last_flush",null)]);return d({pending:a.length,oldest:a[0]?new Date(+a[0].split("-")[0]).toISOString():null,last:o,backend:b})}}return u("rota n\xE3o encontrada",404)}catch(a){if(a instanceof k)return u(a.message,a.status);console.error(a);let o=i==="collect"||i==="config";return u("erro interno: "+(a.message||a),500,o?f:{})}}export{we as cleanup,Ne as flush,yt as handle,De as makeToken,q as syncSitesConfig};
