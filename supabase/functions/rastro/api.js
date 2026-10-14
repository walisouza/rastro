var ge=Object.create;var X=Object.defineProperty;var we=Object.getOwnPropertyDescriptor;var ve=Object.getOwnPropertyNames;var ye=Object.getPrototypeOf,be=Object.prototype.hasOwnProperty;var j=(t,e)=>()=>{try{return e||t((e={exports:{}}).exports,e),e.exports}catch(s){throw e=0,s}};var xe=(t,e,s,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ve(e))!be.call(t,n)&&n!==s&&X(t,n,{get:()=>e[n],enumerable:!(a=we(e,n))||a.enumerable});return t};var T=(t,e,s)=>(s=t!=null?ge(ye(t)):{},xe(e||!t||!t.__esModule?X(s,"default",{value:t,enumerable:!0}):s,t));var ee=j(()=>{throw new Error("indispon\xEDvel na Edge Function: npm:postgres@3.4.5")});var te=j(()=>{throw new Error("indispon\xEDvel na Edge Function: pg")});var se=j(()=>{throw new Error("indispon\xEDvel na Edge Function: @netlify/database")});var ne=j(()=>{throw new Error("indispon\xEDvel na Edge Function: @neondatabase/serverless")});var oe=j(()=>{throw new Error("indispon\xEDvel na Edge Function: @netlify/blobs")});import{createHmac as Se,createHash as Ee,timingSafeEqual as pe,randomBytes as Y}from"node:crypto";import{Buffer as $}from"node:buffer";var Z=["create table if not exists hm_meta (k text primary key, v text)",`create table if not exists hm_sites (
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
   end $f$`,"alter table hm_sites add column if not exists goal text not null default ''","alter table hm_sites add column if not exists goal_label text not null default 'Clicou no link de convers\xE3o'",`create or replace function hm_is_goal(m jsonb, goal text)
   returns boolean language sql immutable as $f$
   select case
     when m is null or m->>'href' is null then false
     when coalesce(trim(goal), '') = '' then coalesce(m->>'out', '') = '1'
     else exists (select 1 from unnest(string_to_array(goal, ',')) p
                  where trim(p) <> '' and (m->>'href') ilike '%' || trim(p) || '%')
   end
   $f$`,"create index if not exists hm_events_session_click on hm_events(session_id) where type = 'click' and meta ? 'href'"];var M=t=>globalThis.Netlify?.env?.get?.(t)??globalThis.Deno?.env?.get?.(t)??globalThis.process?.env?.[t],ke=t=>"{"+t.map(e=>e==null?"NULL":'"'+String(e).replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"').join(",")+"}",w=null,N=null,b=null;async function ie(){if(w)return w;if(globalThis.__HM_TEST_DB){let s=globalThis.__HM_TEST_DB;return b="pglite",w=async(a,n=[])=>(await s.query(a,n)).rows,w}let t=M("DATABASE_URL"),e=M("SUPABASE_DB_URL");if(globalThis.Deno&&(t||e)){let a=(globalThis.__RASTRO_POSTGRES||(await Promise.resolve().then(()=>T(ee(),1))).default)(t||e,{max:Number(M("RASTRO_PG_MAX"))||2,prepare:!1,idle_timeout:20,connect_timeout:10});return b="supabase",w=async(n,i=[])=>{let o=new Set([...n.matchAll(/\$(\d+)::jsonb/g)].map(c=>+c[1]-1)),l=i.map((c,m)=>Array.isArray(c)?ke(c):o.has(m)&&typeof c=="string"?JSON.parse(c):c);return[...await a.unsafe(n,l)]},w}if(t){let{default:s}=await Promise.resolve().then(()=>T(te(),1)),a=new s.Pool({connectionString:t,max:3,idleTimeoutMillis:1e4,ssl:/sslmode=disable|localhost|127\.0\.0\.1/.test(t)?!1:{rejectUnauthorized:!1}});return b="postgres",w=async(n,i=[])=>(await a.query(n,i)).rows,w}try{let{getDatabase:s}=await Promise.resolve().then(()=>T(se(),1)),a=s();return b="netlify-database",w=async(n,i=[])=>(await a.pool.query(n,i)).rows,w}catch{let a=M("NETLIFY_DATABASE_URL");if(a){let{neon:i}=await Promise.resolve().then(()=>T(ne(),1)),o=i(a);return b="netlify-db-legacy",w=(l,c=[])=>o.query(l,c),w}let n=new Error("Banco de dados n\xE3o configurado. Crie um em Netlify > Data & Storage > Database, ou defina a vari\xE1vel DATABASE_URL com um Postgres (ex.: Supabase).");throw n.code="NO_DB",n}}async function r(t,e=[]){return await $e(),(await ie())(t,e)}async function h(t,e=[]){return(await r(t,e))[0]||null}function $e(){return N||(N=(async()=>{let t=await ie();if(b==="netlify-database"||b==="supabase")return;let e=0;try{let s=await t("select v from hm_meta where k = 'schema'");e=s.length?Number(s[0].v):0}catch{e=0}if(!(e>=2)){for(let s of Z)await t(s);await t("insert into hm_meta (k, v) values ('schema', $1) on conflict (k) do update set v = excluded.v",[String(2)])}})().catch(t=>{throw N=null,t})),N}var I=new Map,U=t=>globalThis.Deno?.env?.get?.(t);function re(t){let e=U("SUPABASE_URL")+"/storage/v1/object",s=U("SUPABASE_SERVICE_ROLE_KEY"),a=(i={})=>({authorization:"Bearer "+s,apikey:s,...i}),n=i=>i.split("/").map(encodeURIComponent).join("/");return{set:async(i,o)=>{let l=await fetch(`${e}/${t}/${n(i)}`,{method:"POST",headers:a({"content-type":"application/octet-stream","x-upsert":"true"}),body:o});if(!l.ok)throw new Error("storage set "+l.status+" "+(await l.text()).slice(0,200))},get:async(i,o)=>{let l=await fetch(`${e}/${t}/${n(i)}`,{headers:a()});if(l.status===404||l.status===400)return null;if(!l.ok)throw new Error("storage get "+l.status);return o==="text"?l.text():new Uint8Array(await l.arrayBuffer())},delete:async i=>re(t).deleteMany([i]),deleteMany:async i=>{for(let o=0;o<i.length;o+=100)await fetch(`${e}/${t}`,{method:"DELETE",headers:a({"content-type":"application/json"}),body:JSON.stringify({prefixes:i.slice(o,o+100)})})},list:async()=>[]}}function H(t){if(I.has(t))return I.get(t);let e;if(globalThis.Deno&&U("SUPABASE_URL"))e=re(t);else if(globalThis.__HM_TEST_BLOBS){let s=globalThis.__HM_TEST_BLOBS;s.has(t)||s.set(t,new Map);let a=s.get(t);e={set:async(n,i)=>{a.set(n,typeof i=="string"?i:Buffer.from(i))},get:async(n,i)=>{if(!a.has(n))return null;let o=a.get(n);return i==="text"?String(o):Buffer.from(o)},delete:async n=>{a.delete(n)},list:async(n="")=>[...a.keys()].filter(i=>i.startsWith(n)).sort()}}else{let s=null,a=async()=>{if(!s){let{getStore:n}=await Promise.resolve().then(()=>T(oe(),1));s=n({name:t,consistency:t==="rastro-replay"?"eventual":"strong"})}return s};e={set:async(n,i)=>(await a()).set(n,typeof i=="string"?i:new Blob([i])),get:async(n,i)=>{let o=await a();if(i==="text")return o.get(n,{type:"text"});let l=await o.get(n,{type:"arrayBuffer"});return l?Buffer.from(l):null},delete:async n=>(await a()).delete(n),list:async(n="")=>(await(await a()).list(n?{prefix:n}:{})).blobs.map(o=>o.key).sort()}}return I.set(t,e),e}var q=()=>H("rastro-replay"),z=()=>H("rastro-inbox"),D=()=>H("rastro-meta");async function B(t,e,s=null){try{let a=await t.get(e,"text");return a?JSON.parse(a):s}catch{return s}}async function J(t,e,s){return t.set(e,JSON.stringify(s))}var P=t=>globalThis.Netlify?.env?.get?.(t)??globalThis.Deno?.env?.get?.(t)??globalThis.process?.env?.[t],O=()=>!!globalThis.Deno||P("HM_DIRECT")==="1",f={"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-allow-headers":"content-type, authorization","access-control-max-age":"86400"},d=(t,e=200,s={})=>new Response(JSON.stringify(t),{status:e,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...s}}),u=(t,e=400,s={})=>d({error:t},e,s),v=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,x={pw:null,secret:""},le=0,ue=t=>Ee("sha256").update(String(t)).digest("hex");async function F(){if(P("HM_PASSWORD"))return x={pw:ue(P("HM_PASSWORD")),secret:P("HM_SECRET")||P("HM_PASSWORD")},x;if(Date.now()-le<3e5)return x;try{let t=await r("select k, v from hm_meta where k in ('auth_pw_sha256', 'auth_secret')"),e=Object.fromEntries(t.map(s=>[s.k,s.v]));x={pw:e.auth_pw_sha256||null,secret:e.auth_secret||e.auth_pw_sha256||""},le=Date.now()}catch{}return x}function K(){return x.secret||""}function _e(t){return Se("sha256",K()).update(t).digest("base64url")}function je(t=30){let e=$.from(JSON.stringify({exp:Date.now()+t*864e5,n:Y(6).toString("hex")})).toString("base64url");return e+"."+_e(e)}function Te(t){if(!t||!K())return!1;let[e,s]=t.split(".");if(!e||!s)return!1;let a=$.from(_e(e)),n=$.from(s);if(a.length!==n.length||!pe(a,n))return!1;try{return JSON.parse($.from(e,"base64url").toString()).exp>Date.now()}catch{return!1}}function De(t){let e=t.headers.get("authorization")||"";return Te(e.replace(/^Bearer\s+/i,""))}var k=null,G=0;async function R(){if(O())return k=null,V.clear(),{};let t=await r("select id, site_key, domains, replay_sample, mask_text from hm_sites"),e=Object.fromEntries(t.map(s=>[s.site_key,{id:s.id,domains:s.domains,replay_sample:s.replay_sample,mask_text:s.mask_text}]));return await J(D(),"sites",e),k=e,G=Date.now(),e}var V=new Map;async function me(t){if(O()){let e=V.get(t);if(e&&Date.now()-e.t<6e4)return e.site;let s=await h("select id, domains, replay_sample, mask_text from hm_sites where site_key = $1",[t]);return V.set(t,{site:s,t:Date.now()}),s}return(!k||Date.now()-G>6e4)&&(k=await B(D(),"sites",null),G=Date.now(),k||(k=await R().catch(()=>({})))),k[t]||null}function Pe(t,e){let s=(t.domains||[]).map(i=>i.trim().toLowerCase()).filter(Boolean);if(!s.length)return!0;let a=e.headers.get("origin")||e.headers.get("referer")||"",n="";try{n=new URL(a).hostname.toLowerCase()}catch{return!1}return s.some(i=>n===i||n.endsWith("."+i))}async function Oe(t){let e=await t.text();if(e.length>55e5)return u("payload too large",413,f);let s;try{s=JSON.parse(e)}catch{return u("bad json",400,f)}if(!s||typeof s.k!="string"||!s.s||!v.test(s.s.id||""))return u("bad payload",400,f);let a=await me(s.k);if(!a)return u("unknown site",404,f);if(!Pe(a,t))return u("origin not allowed",403,f);let n=Array.isArray(s.r)?s.r.slice(0,20):[];s.r=[];for(let o of n){if(!o||typeof o.d!="string"||!v.test(o.pv||""))continue;let l=$.from(o.d,"base64");if(!l.length||l.length>5e6)continue;let c=`${a.id}/${s.s.id}/${Date.now()}-${o.seq|0}-${Y(3).toString("hex")}`;await q().set(c,l),s.r.push({pv:o.pv,seq:o.seq|0,ts:o.ts,snap:!!o.snap,enc:o.enc==="raw"?"raw":"gz",size:l.length,key:c})}if(s.p=(Array.isArray(s.p)?s.p:[]).filter(o=>o&&v.test(o.id||"")).slice(0,5),s.e=(Array.isArray(s.e)?s.e:[]).filter(o=>o&&(!o.pv||v.test(o.pv))).slice(0,3e3),!s.p.length&&!s.e.length&&!s.r.length)return d({ok:!0},200,f);if(O())return await h("select hm_ingest($1::jsonb, $2::uuid) as r",[JSON.stringify(s),a.id]),Ge(),d({ok:!0},202,f);let i=`${String(Date.now()).padStart(15,"0")}-${Y(4).toString("hex")}`;return await z().set(i,JSON.stringify({site:a.id,p:s})),d({ok:!0},202,f)}var Ae=150;async function Me(t=8e3){let e=Date.now(),s=z(),a=await s.list(),n=0,i=0,o=0;for(;o<a.length&&Date.now()-e<t;){let c=a.slice(o,o+Ae);o+=c.length;let m=[];for(let p=0;p<c.length;p+=25){let y=await Promise.all(c.slice(p,p+25).map(E=>B(s,E,null)));m.push(...y)}let g=m.filter(p=>p&&p.site&&p.p);if(g.length){let p=await h("select hm_ingest_many($1::jsonb) as r",[JSON.stringify(g)]);n+=p?.r?.ok||0,i+=p?.r?.failed||0}for(let p=0;p<c.length;p+=25)await Promise.all(c.slice(p,p+25).map(y=>s.delete(y)))}let l=new Date().toISOString();return await J(D(),"last_flush",{at:l,processed:n,failed:i}),{processed:n,failed:i,remaining:a.length-o,at:l}}async function Ne(t){let e=await me(t.searchParams.get("k")||"");return e?d({rs:e.replay_sample,mt:e.mask_text},200,{...f,"cache-control":"public, max-age=300"}):u("unknown site",404,f)}function S(t){let e=t.searchParams.get("site");if(!v.test(e||""))throw new A(400,"site inv\xE1lido");let s=t.searchParams.get("to")?new Date(t.searchParams.get("to")):new Date,a=t.searchParams.get("from")?new Date(t.searchParams.get("from")):new Date(s-30*864e5);if(isNaN(a)||isNaN(s))throw new A(400,"datas inv\xE1lidas");let n=["desktop","tablet","mobile"].includes(t.searchParams.get("device"))?t.searchParams.get("device"):null,i=t.searchParams.get("grouped")==="1",o=t.searchParams.get("tz")||"America/Sao_Paulo";return{site:e,from:a.toISOString(),to:s.toISOString(),device:n,grouped:i,tz:o,span:s-a}}var A=class extends Error{constructor(e,s){super(s),this.status=e}},_=`s as (select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv
  from hm_sessions ss join hm_sites st on st.id = ss.site_id
  where ss.site_id = $1 and ss.started_at >= $2 and ss.started_at < $3 and ($4::text is null or ss.device = $4))`,Q=t=>t?"hm_label($1, pv.path)":"pv.path";async function qe(t){let e=S(t),s=[e.site,e.from,e.to,e.device],a=new Date(new Date(e.from)-e.span).toISOString(),n=e.span<=2.1*864e5?"hour":"day",i=`with ${_}
    select count(*)::int sessions, count(distinct visitor_id)::int visitors, coalesce(sum(pageviews),0)::int pageviews,
      avg((pageviews <= 1 and not conv)::int)::float bounce, avg(duration_ms)::float avg_duration, avg(pageviews)::float pps,
      avg(conv::int)::float conversion, count(*) filter (where conv)::int conversions,
      avg((rage_clicks > 0)::int)::float rage, avg((dead_clicks > 0)::int)::float dead, avg((errors > 0)::int)::float errors,
      avg(is_new::int)::float new_visitors, count(*) filter (where has_replay)::int replays,
      (select avg(least(100, pv.max_scroll_px * 100.0 / nullif(pv.doc_h, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float scroll,
      (select avg(least(1, pv.active_ms * 1.0 / nullif(pv.duration_ms, 0))) from hm_pageviews pv join s on s.id = pv.session_id)::float activity
    from s`,[o,l,c,m,g,p,y,E,C]=await Promise.all([h(i,s),h(i,[e.site,a,e.from,e.device]),r(`with ${_}, b as (
        select generate_series(date_trunc('${n}', $2::timestamptz at time zone $5), date_trunc('${n}', $3::timestamptz at time zone $5), interval '1 ${n}') b)
       select to_char(b.b, 'YYYY-MM-DD"T"HH24:MI') b, count(s.id)::int sessions, coalesce(sum(s.pageviews),0)::int pageviews,
         count(s.id) filter (where s.conv)::int converted,
         count(s.id) filter (where s.rage_clicks > 0 or s.dead_clicks > 0 or s.errors > 0)::int frustrated
       from b left join s on date_trunc('${n}', s.started_at at time zone $5) = b.b group by b.b order by b.b`,[...s,e.tz]),r(`with ${_} select coalesce(device,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(duration_ms)::float dur from s group by 1 order by 2 desc`,s),r(`with ${_}, c as (select *, case
          when coalesce(utm_medium,'') ~* '(cpc|ppc|paid|ads)' then 'M\xEDdia paga'
          when coalesce(utm_medium,'') ~* 'email' then 'E-mail'
          when coalesce(utm_source,'') <> '' and coalesce(utm_medium,'') ~* 'social' then 'Social'
          when coalesce(utm_source,'') <> '' then 'Campanha (UTM)'
          when coalesce(referrer,'') = '' then 'Direto'
          when referrer ~* '(google|bing|yahoo|duckduckgo|ecosia|yandex)\\.' then 'Busca org\xE2nica'
          when referrer ~* '(facebook|instagram|t\\.co|twitter|x\\.com|linkedin|tiktok|youtube|pinterest|whatsapp|threads)' then 'Social'
          else 'Refer\xEAncia' end ch from s)
        select ch k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv from c group by 1 order by 2 desc`,s),r(`with ${_} select coalesce(nullif(substring(referrer from '^[a-z]+://([^/:]+)'),''), '(direto)') k, count(*)::int n
       from s group by 1 order by 2 desc limit 10`,s),r(`with ${_} select coalesce(landing_path,'?') k, count(*)::int n, avg((pageviews<=1 and not conv)::int)::float bounce, avg(conv::int)::float conv, avg(duration_ms)::float dur
       from s group by 1 order by 2 desc limit 10`,s),r(`with ${_} select e.txt k, count(*)::int n, count(distinct e.session_id)::int sessions, max(e.path) path
       from hm_events e join s on s.id = e.session_id where e.site_id = $1 and e.type = 'error' group by 1 order by 3 desc limit 10`,s),r(`with ${_} select coalesce(browser,'?') || ' \xB7 ' || coalesce(os,'?') k, count(*)::int n from s group by 1 order by 2 desc limit 8`,s)]);return d({kpis:o,prev:l,bucket:n,series:c,devices:m,channels:g,refs:p,landings:y,errors:E,browsers:C})}async function ze(t){let e=S(t),s=await r(`with ${_},
    pv as (
      select pv.*, s.conv, ${Q(e.grouped)} label,
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
    group by label order by views desc limit 500`,[e.site,e.from,e.to,e.device]);return d({rows:s})}async function Be(t){let e=S(t),s=t.searchParams.get("page")||"/",a=e.device||"desktop",n=[e.site,e.from,e.to,a,s],i=`${_}, pvs as (
      select pv.* from hm_pageviews pv join s on s.id = pv.session_id
      where pv.site_id = $1 and ${e.grouped?"hm_label($1, pv.path)":"pv.path"} = $5)`,[o,l,c,m,g,p,y,E]=await Promise.all([h(`with ${i} select count(*)::int pageviews, count(distinct session_id)::int sessions,
          percentile_disc(0.5) within group (order by vw) vw, avg(vh)::int vh, avg(doc_h)::int doc_h,
          avg(duration_ms)::float avg_time, avg(clicks)::float clicks
         from pvs`,n),r(`with ${i} select least(100, round(greatest(max_scroll_px, vh) * 100.0 / nullif(doc_h, 0)))::int r from pvs where doc_h > 0 limit 20000`,n),r(`with ${i} select e.sel, e.ox, e.oy, e.x, e.y, e.w from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' order by e.id desc limit 40000`,n),r(`with ${i} select e.type, e.sel, e.ox, e.oy, e.x, e.y, e.w, e.txt from hm_events e join pvs on pvs.id = e.pageview_id where e.type in ('rage','dead') order by e.id desc limit 10000`,n),r(`with ${i} select e.x, e.y, e.w, sum(e.val)::int v from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'move' group by 1,2,3 order by 4 desc limit 40000`,n),r(`with ${i} select e.sel, count(*)::int clicks, count(distinct e.pageview_id)::int pv, max(e.txt) txt,
          min(e.y) y
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'click' group by 1 order by 2 desc limit 2000`,n),r(`with ${i} select e.sel, sum(e.val)::bigint ms, count(distinct e.pageview_id)::int pv, max(e.txt) txt
         from hm_events e join pvs on pvs.id = e.pageview_id where e.type = 'hover' group by 1 order by 2 desc limit 2000`,n),r(`with ${i} select r.pageview_id pv, pvs.vw, pvs.vh, pvs.doc_h, pvs.url, r.ts
         from hm_replay r join pvs on pvs.id = r.pageview_id where r.has_snapshot order by r.ts desc limit 8`,n)]);return d({device:a,page:s,summary:o,reach:l.map(C=>C.r),clicks:c,frust:m,moves:g,zones:p,hovers:y,snaps:E})}async function Re(t){let e=t.searchParams.get("pv");if(!v.test(e||""))return u("pv inv\xE1lido");let s=await r("select blob_key key, enc, seq, ts from hm_replay where pageview_id = $1 order by seq, ts limit 12",[e]);return d({chunks:s})}async function Le(t){let e=S(t),s=t.searchParams,a=[e.site,e.from,e.to,e.device],n=[],i=(p,y)=>{a.push(y),n.push(p.replaceAll("$?","$"+a.length))};s.get("replay")==="1"&&n.push("s.has_replay"),s.get("frustration")==="1"&&n.push("(s.rage_clicks > 0 or s.dead_clicks > 0)"),s.get("rage")==="1"&&n.push("s.rage_clicks > 0"),s.get("errors")==="1"&&n.push("s.errors > 0"),s.get("bounce")==="1"&&n.push("(s.pageviews <= 1 and not s.conv)"),s.get("converted")==="1"&&n.push("s.conv"),s.get("notconverted")==="1"&&n.push("not s.conv"),s.get("new")==="1"&&n.push("s.is_new"),+s.get("min_dur")>0&&i("s.duration_ms >= $?",+s.get("min_dur")*1e3),s.get("page")&&i("exists (select 1 from hm_pageviews x where x.session_id = s.id and x.path ilike $?)","%"+s.get("page")+"%"),s.get("landing")&&i("s.landing_path ilike $?","%"+s.get("landing")+"%"),s.get("source")&&i("(s.utm_source ilike $? or s.referrer ilike $?)","%"+s.get("source")+"%"),s.get("visitor")&&i("s.visitor_id = $?",s.get("visitor")),s.get("ids")&&i("s.id = any($?::uuid[])",s.get("ids").split(",").filter(p=>v.test(p)));let o=Math.min(200,+s.get("limit")||50),l=Math.max(0,+s.get("offset")||0),c=n.length?" and "+n.join(" and "):"",[m,g]=await Promise.all([r(`with ${_} select s.id, s.visitor_id, s.started_at, s.duration_ms, s.pageviews, s.device, s.browser, s.os,
          s.referrer, s.utm_source, s.utm_campaign, s.landing_path, s.exit_path, s.clicks, s.rage_clicks, s.dead_clicks,
          s.errors, s.is_new, s.has_replay, s.screen_w, s.screen_h, s.lang, s.conv,
          (select array_agg(path order by seq) from (select path, seq from hm_pageviews x where x.session_id = s.id order by seq limit 10) t) paths
        from s where true ${c} order by s.started_at desc limit ${o} offset ${l}`,a),h(`with ${_} select count(*)::int n from s where true ${c}`,a)]);return d({rows:m,total:g.n})}async function Ce(t){let e=t.searchParams.get("id");if(!v.test(e||""))return u("id inv\xE1lido");let[s,a,n,i]=await Promise.all([h(`select ss.*, exists(select 1 from hm_events e where e.session_id = ss.id and e.type = 'click' and hm_is_goal(e.meta, st.goal)) conv,
           st.goal, st.goal_label from hm_sessions ss join hm_sites st on st.id = ss.site_id where ss.id = $1`,[e]),r("select id, seq, url, path, title, ts, vw, vh, doc_h, max_scroll_px, duration_ms, active_ms, clicks from hm_pageviews where session_id = $1 order by seq",[e]),r("select type, ts, pageview_id pv, path, sel, txt, x, y, meta from hm_events where session_id = $1 and type in ('click','rage','dead','error') order by ts limit 3000",[e]),r("select blob_key key, enc, seq, ts, pageview_id pv, has_snapshot snap, size from hm_replay where session_id = $1 order by ts, seq, id",[e])]);return s?d({session:s,pageviews:a,events:n,chunks:i}):u("sess\xE3o n\xE3o encontrada",404)}async function Ie(t){let e=t.searchParams.get("key")||"";if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w-]+$/i.test(e))return u("key inv\xE1lida");let s=await q().get(e);return s?new Response(s,{headers:{"content-type":"application/octet-stream","cache-control":"private, max-age=86400"}}):u("n\xE3o encontrado",404)}var he=t=>`${_}, seqs as (
    select session_id, bool_or(conv) conv, array_agg(label order by seq) labels from (
      select pv.session_id, s.conv, pv.seq, l.label, lag(l.label) over (partition by pv.session_id order by pv.seq) prev
      from hm_pageviews pv join s on s.id = pv.session_id
      cross join lateral (select ${Q(t)} label) l
    ) t where prev is distinct from label group by session_id)`;async function Ue(t){let e=S(t),s=Math.min(8,Math.max(2,+t.searchParams.get("depth")||5)),a=t.searchParams.get("start")||null,n=await r(`with ${he(e.grouped)},
    trimmed as (
      select conv, case when $5::text is null then labels else labels[array_position(labels, $5::text):] end labels
      from seqs where $5::text is null or array_position(labels, $5::text) is not null)
    select labels[1:${s}] path, (cardinality(labels) > ${s}) more, conv, count(*)::int n
    from trimmed group by 1, 2, 3 order by 4 desc limit 5000`,[e.site,e.from,e.to,e.device,a]);return d({depth:s,rows:n})}async function He(t){let e=S(t),s=[];try{s=JSON.parse(t.searchParams.get("steps")||"[]").map(String).slice(0,12)}catch{}if(s.length<2)return u("informe pelo menos 2 etapas");if(s.slice(0,-1).includes("__goal__"))return u("a convers\xE3o precisa ser a \xFAltima etapa");let a=s[s.length-1]==="__goal__",n=a?s.slice(0,-1):s,[i,o]=await Promise.all([r(`with ${he(e.grouped)} select hm_funnel_level(labels, $5::text[]) lvl, conv, count(*)::int n from seqs group by 1, 2`,[e.site,e.from,e.to,e.device,n]),h(`with ${_} select count(*)::int n from s`,[e.site,e.from,e.to,e.device])]),l=n.map((c,m)=>i.filter(g=>g.lvl>=m+1).reduce((g,p)=>g+p.n,0));return a&&l.push(i.filter(c=>c.lvl>=n.length&&c.conv).reduce((c,m)=>c+m.n,0)),d({steps:s,counts:l,total:o.n})}async function Je(t){let e=S(t),s=await r(`with ${_} select ${Q(e.grouped)} label, count(*)::int n
    from hm_pageviews pv join s on s.id = pv.session_id group by 1 order by 2 desc limit 400`,[e.site,e.from,e.to,e.device]);return d({rows:s})}var W="id, name, domains, site_key, replay_sample, mask_text, replay_days, data_days, goal, goal_label, created_at";function ce(t){let e=(Array.isArray(t.domains)?t.domains:String(t.domains||"").split(/[\s,]+/)).map(s=>String(s).trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/^www\./,"")).filter(Boolean).slice(0,20);return[String(t.name||"Novo site").slice(0,80),e,Math.min(1,Math.max(0,Number(t.replay_sample??1))),!!t.mask_text,Math.min(365,Math.max(1,parseInt(t.replay_days??30))),Math.min(730,Math.max(7,parseInt(t.data_days??180))),String(t.goal??"").slice(0,300),String(t.goal_label||"Clicou no link de convers\xE3o").slice(0,60)]}async function Fe(t,e,s){if(t.method==="GET")return d({rows:await r(`select ${W},
      (select max(started_at) from hm_sessions x where x.site_id = hm_sites.id) last_seen
      from hm_sites order by created_at`)});if(t.method==="POST"){let a=await t.json(),n=await h(`insert into hm_sites (name, domains, replay_sample, mask_text, replay_days, data_days, goal, goal_label)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning ${W}`,ce(a));return await R(),d(n)}if(!v.test(s||""))return u("id inv\xE1lido");if(t.method==="PUT"){let a=await t.json(),n=await h(`update hm_sites set name=$2, domains=$3, replay_sample=$4, mask_text=$5, replay_days=$6, data_days=$7, goal=$8, goal_label=$9
      where id=$1 returning ${W}`,[s,...ce(a)]);return await R(),d(n)}if(t.method==="DELETE"){let a=await r("select blob_key from hm_replay where site_id = $1",[s]);return await L(a.map(n=>n.blob_key)),await r("delete from hm_sites where id = $1",[s]),await R(),d({ok:!0})}return u("m\xE9todo",405)}async function We(t,e,s){if(t.method==="GET"){let a=e.searchParams.get("site");return v.test(a||"")?d({rows:await r("select * from hm_page_groups where site_id = $1 order by position, id",[a])}):u("site inv\xE1lido")}if(t.method==="POST"){let a=await t.json();if(!v.test(a.site_id||"")||!a.name||!a.pattern)return u("campos obrigat\xF3rios");let n=["exact","prefix","contains","regex"].includes(a.match_type)?a.match_type:"prefix";return d(await h(`insert into hm_page_groups (site_id, name, match_type, pattern, position)
      values ($1,$2,$3,$4, coalesce((select max(position)+1 from hm_page_groups where site_id=$1),0)) returning *`,[a.site_id,String(a.name).slice(0,80),n,String(a.pattern).slice(0,300)]))}return t.method==="DELETE"&&/^\d+$/.test(s||"")?(await r("delete from hm_page_groups where id = $1",[s]),d({ok:!0})):u("m\xE9todo",405)}async function Ye(t){if(!v.test(t||""))return u("id inv\xE1lido");let e=await r("select blob_key from hm_replay where session_id = $1",[t]);return await L(e.map(s=>s.blob_key)),await r("delete from hm_sessions where id = $1",[t]),d({ok:!0})}var de=0;function Ge(){if(Date.now()-de<6*36e5)return;de=Date.now();let t=(async()=>{let e=await h("select v from hm_meta where k = 'last_cleanup'");e&&Date.now()-new Date(e.v).getTime()<20*36e5||(await r("insert into hm_meta (k, v) values ('last_cleanup', $1) on conflict (k) do update set v = excluded.v",[new Date().toISOString()]),await fe())})().catch(e=>console.error("cleanup",e));globalThis.EdgeRuntime?.waitUntil?.(t)}var L=async t=>{if(!t.length)return;let e=q();if(e.deleteMany)return e.deleteMany(t).catch(()=>{});for(let s of t)await e.delete(s).catch(()=>{})};async function fe(){let t=await r(`select r.id, r.blob_key from hm_replay r join hm_sites s on s.id = r.site_id
                        where r.ts < now() - make_interval(days => s.replay_days) limit 5000`);await L(t.map(s=>s.blob_key)),t.length&&await r("delete from hm_replay where id = any($1::bigint[])",[t.map(s=>s.id)]),await r("update hm_sessions ss set has_replay = false where has_replay and not exists (select 1 from hm_replay r where r.session_id = ss.id)");let e=await r(`select r.blob_key from hm_replay r join hm_sessions ss on ss.id = r.session_id join hm_sites s on s.id = ss.site_id
                         where ss.started_at < now() - make_interval(days => s.data_days) limit 5000`);return await L(e.map(s=>s.blob_key)),await r("delete from hm_sessions ss using hm_sites s where ss.site_id = s.id and ss.started_at < now() - make_interval(days => s.data_days)"),{replays:t.length}}async function ht(t){let e=await Ve(t);for(let[s,a]of Object.entries(f))e.headers.has(s)||e.headers.set(s,a);return e}async function Ve(t){let e=new URL(t.url),s=e.pathname.replace(/^\/(\.netlify\/functions\/api|api|functions\/v1\/rastro|rastro)/,"").replace(/\/+$/,"")||"/",[,a,n]=s.split("/");try{if(t.method==="OPTIONS")return new Response(null,{status:204,headers:f});if(a==="collect"&&t.method==="POST")return await Oe(t);if(a==="config")return await Ne(e);if(a==="health")return await F(),d({ok:!0,auth:!!K()});if(a==="login"&&t.method==="POST"){if(await F(),!x.pw)return u("Senha do painel n\xE3o configurada no servidor",503);let{password:i}=await t.json().catch(()=>({})),o=$.from(ue(String(i||""))),l=$.from(x.pw);return o.length!==l.length||!pe(o,l)?(await new Promise(c=>setTimeout(c,600)),u("Senha incorreta",401)):d({token:je()})}if(await F(),!De(t))return u("n\xE3o autenticado",401);switch(a){case"sites":return await Fe(t,e,n);case"groups":return await We(t,e,n);case"overview":return await qe(e);case"pages":return await ze(e);case"heatmap":return await Be(e);case"snapshot":return await Re(e);case"sessions":return await Le(e);case"session":return t.method==="DELETE"?await Ye(n):await Ce(e);case"chunk":return await Ie(e);case"journey":return await Ue(e);case"funnel":return await He(e);case"labels":return await Je(e);case"cleanup":return d(await fe());case"flush":return d(O()?{processed:0,failed:0,remaining:0,at:new Date().toISOString()}:await Me(Math.min(2e4,+e.searchParams.get("budget")||7e3)));case"status":{if(O())return d({pending:0,oldest:null,last:{at:new Date().toISOString()},backend:"direto"});let[i,o]=await Promise.all([z().list(),B(D(),"last_flush",null)]);return d({pending:i.length,oldest:i[0]?new Date(+i[0].split("-")[0]).toISOString():null,last:o,backend:b})}}return u("rota n\xE3o encontrada",404)}catch(i){if(i instanceof A)return u(i.message,i.status);console.error(i);let o=a==="collect"||a==="config";return u("erro interno: "+(i.message||i),500,o?f:{})}}export{fe as cleanup,Me as flush,ht as handle,je as makeToken,R as syncSitesConfig};
