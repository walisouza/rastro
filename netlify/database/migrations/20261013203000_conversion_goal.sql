-- Rastro v2: conversão por clique em link (ex.: botão da ticketeria)

alter table hm_sites add column if not exists goal text not null default '';

alter table hm_sites add column if not exists goal_label text not null default 'Clicou no link de conversão';

create or replace function hm_is_goal(m jsonb, goal text)
   returns boolean language sql immutable as $f$
   select case
     when m is null or m->>'href' is null then false
     when coalesce(trim(goal), '') = '' then coalesce(m->>'out', '') = '1'
     else exists (select 1 from unnest(string_to_array(goal, ',')) p
                  where trim(p) <> '' and (m->>'href') ilike '%' || trim(p) || '%')
   end
   $f$;

create index if not exists hm_events_session_click on hm_events(session_id) where type = 'click' and meta ? 'href';

update hm_meta set v = '2' where k = 'schema';
