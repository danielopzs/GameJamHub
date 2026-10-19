-- Run once in the SQL Editor of a new Supabase project. No service_role key is needed in the app.
begin;
create table public.jam_events (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 150), revision bigint not null default 1, created_at timestamptz not null default now()
);
create table public.jam_members (
 event_id uuid not null references public.jam_events(id) on delete cascade,
 email text not null check(email=lower(email) and length(email) between 3 and 254),
 name text not null check(length(name) between 1 and 120),
 role text not null check(role in ('organizer','judge')), primary key(event_id,email)
);
create table public.jam_state (
 event_id uuid not null references public.jam_events(id) on delete cascade,
 key text not null check(key in ('gj-event','gj-host','gj-hosts','gj-tasks','gj-members','gj-teams','gj-weight','gj-participants')),
 value jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now(),
 primary key(event_id,key), check(octet_length(value::text)<1000000)
);
create function public.jam_valid_scores(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare caps int[] := array[10,10,5,5,5,5,5,5,10,5,5,5,5,10,10,5,5,2,2,2,4]; n numeric; i int;
begin
 if jsonb_typeof(s) is distinct from 'array' then return false; end if;
 if jsonb_array_length(s)<>21 then return false; end if;
 for i in 0..20 loop
  if jsonb_typeof(s->i) is distinct from 'number' then return false; end if;
  n:=(s->>i)::numeric;
  if n<0 or n>caps[i+1] or n<>trunc(n) then return false; end if;
 end loop; return true;
end $$;
create function public.jam_score_total(s jsonb) returns numeric language sql immutable set search_path='' as $$
 select coalesce(sum(value::numeric),0) from jsonb_array_elements_text(s)
$$;
create table public.jam_evaluations (
 event_id uuid not null references public.jam_events(id) on delete cascade,
 judge_id uuid not null references auth.users(id), judge_email text not null,
 team_code text not null, scores jsonb not null check(public.jam_valid_scores(scores)),
 total numeric generated always as (public.jam_score_total(scores)) stored,
 updated_at timestamptz not null default now(), primary key(event_id,judge_id,team_code)
);
create index jam_evaluations_team_idx on public.jam_evaluations(event_id,team_code);
create index jam_members_email_idx on public.jam_members(email);
create function public.jam_is_organizer(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.jam_events where id=e and owner_id=(select auth.uid()))
 or exists(select 1 from public.jam_members where event_id=e and email=lower((select auth.jwt())->>'email') and role='organizer')
$$;
create function public.jam_is_member(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.jam_is_organizer(e) or exists(select 1 from public.jam_members where event_id=e and email=lower((select auth.jwt())->>'email'))
$$;
create function public.jam_is_judge(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.jam_members where event_id=e and email=lower((select auth.jwt())->>'email') and role='judge')
$$;
alter table public.jam_events enable row level security;
alter table public.jam_members enable row level security;
alter table public.jam_state enable row level security;
alter table public.jam_evaluations enable row level security;
create policy event_read on public.jam_events for select to authenticated using(public.jam_is_member(id));
create policy member_read on public.jam_members for select to authenticated using(public.jam_is_organizer(event_id) or email=lower((select auth.jwt())->>'email'));
create policy state_read on public.jam_state for select to authenticated using(public.jam_is_organizer(event_id) or (public.jam_is_member(event_id) and key in ('gj-event','gj-teams','gj-weight')));
create policy evaluation_read on public.jam_evaluations for select to authenticated using(public.jam_is_organizer(event_id) or (judge_id=(select auth.uid()) and public.jam_is_judge(event_id)));
-- Writes are exclusively through the narrowly-scoped RPCs below; no direct INSERT/UPDATE/DELETE grants.
grant usage on schema public to authenticated;
grant select on public.jam_events,public.jam_members,public.jam_state,public.jam_evaluations to authenticated;
revoke all on public.jam_events,public.jam_members,public.jam_state,public.jam_evaluations from anon;
revoke insert,update,delete on public.jam_events,public.jam_members,public.jam_state,public.jam_evaluations from authenticated;
create function public.jam_create_event(p_name text,p_seed jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid; k text; v jsonb;
begin
 if auth.uid() is null or nullif(auth.jwt()->>'email','') is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.jam_events where owner_id=auth.uid())>=6 then raise exception 'Esta iteración permite hasta 6 eventos por anfitrión'; end if;
 if length(trim(p_name)) not between 1 and 150 then raise exception 'Nombre de evento inválido'; end if;
 insert into public.jam_events(owner_id,name) values(auth.uid(),trim(p_name)) returning id into e;
 insert into public.jam_members values(e,lower(auth.jwt()->>'email'),coalesce(nullif(auth.jwt()->'user_metadata'->>'full_name',''),auth.jwt()->>'email'),'organizer');
 if jsonb_typeof(p_seed) is distinct from 'object' or octet_length(p_seed::text)>1000000 then raise exception 'Datos de evento inválidos'; end if;
 for k,v in select * from jsonb_each(p_seed) loop
  if k not in ('gj-event','gj-host','gj-hosts','gj-tasks','gj-members','gj-teams','gj-weight','gj-participants') then raise exception 'Colección inválida'; end if;
  -- Creation cannot bypass the same validations used by subsequent writes.
  perform public.jam_save_state(e,k,v,0);
 end loop;
 return e;
end $$;
create function public.jam_save_state(p_event uuid,p_key text,p_value jsonb,p_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare current_revision int; item jsonb; names text[]; total_count int;
begin
 if not public.jam_is_organizer(p_event) then raise exception 'Sin permisos de organización' using errcode='42501'; end if;
 perform 1 from public.jam_events where id=p_event for update;
 if p_key not in ('gj-event','gj-host','gj-hosts','gj-tasks','gj-members','gj-teams','gj-weight','gj-participants') then raise exception 'Colección inválida'; end if;
 if octet_length(p_value::text)>1000000 then raise exception 'Datos demasiado grandes'; end if;
 if p_key in ('gj-event','gj-host') and jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Se esperaba un objeto'; end if;
 if p_key='gj-weight' then
  if jsonb_typeof(p_value) is distinct from 'number' then raise exception 'Ponderación inválida'; end if;
  if p_value::text::numeric not between 0 and 100 then raise exception 'Ponderación fuera de rango'; end if;
 end if;
 if p_key in ('gj-hosts','gj-tasks','gj-members','gj-teams','gj-participants') then
  if jsonb_typeof(p_value) is distinct from 'array' then raise exception 'Se esperaba una lista'; end if;
  total_count:=jsonb_array_length(p_value);
  if p_key='gj-members' and total_count>10 then raise exception 'Máximo 10 miembros operativos por evento'; end if;
  if p_key='gj-participants' and total_count>100 then raise exception 'Máximo 100 participantes por evento'; end if;
  if p_key='gj-participants' then
   for item in select * from jsonb_array_elements(p_value) loop
    if jsonb_typeof(item) is distinct from 'object' or length(coalesce(item->>'name','')) not between 1 and 120 or coalesce(item->>'id','')='' or jsonb_typeof(item->'checkedIn') is distinct from 'boolean' then raise exception 'Participante inválido'; end if;
   end loop;
   if (select count(distinct value->>'id') from jsonb_array_elements(p_value))<>total_count then raise exception 'Participante duplicado'; end if;
  end if;
  if p_key='gj-teams' then
   if total_count>100 then raise exception 'Máximo 100 equipos por evento'; end if;
   for item in select * from jsonb_array_elements(p_value) loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'code','') !~ '^[A-Za-z0-9_-]{1,30}$' or length(coalesce(item->>'name','')) not between 1 and 120 or length(coalesce(item->>'game','')) not between 1 and 150 or coalesce(item->>'votes','') !~ '^[0-9]{1,8}$' then raise exception 'Equipo o votos inválidos'; end if;
   end loop;
   if (select count(distinct value->>'code') from jsonb_array_elements(p_value))<>total_count then raise exception 'Código de equipo duplicado'; end if;
   if exists(select 1 from public.jam_evaluations ev where ev.event_id=p_event and not exists(select 1 from jsonb_array_elements(p_value) t where t->>'code'=ev.team_code)) then raise exception 'No se puede eliminar un equipo evaluado'; end if;
  end if;
 end if;
 select revision into current_revision from public.jam_state where event_id=p_event and key=p_key;
 if coalesce(current_revision,0)<>p_revision then raise exception 'CONFLICT: otra persona modificó esta colección; descarga tu borrador y recarga antes de reintentar' using errcode='40001'; end if;
 insert into public.jam_state(event_id,key,value,revision) values(p_event,p_key,p_value,1)
 on conflict(event_id,key) do update set value=excluded.value,revision=public.jam_state.revision+1,updated_at=now() returning revision into current_revision;
 if p_key='gj-event' then
  if length(trim(coalesce(p_value->>'name',''))) not between 1 and 150 then raise exception 'Nombre inválido'; end if;
  update public.jam_events set name=p_value->>'name' where id=p_event;
 end if;
 update public.jam_events set revision=revision+1 where id=p_event;
 return current_revision;
end $$;
create function public.jam_set_member(p_event uuid,p_email text,p_name text,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if not public.jam_is_organizer(p_event) then raise exception 'Sin permisos' using errcode='42501'; end if;
 perform 1 from public.jam_events where id=p_event for update;
 p_email:=lower(trim(p_email));
 if p_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(p_name) not between 1 and 120 or p_role not in ('organizer','judge') then raise exception 'Datos de acceso inválidos'; end if;
 select count(*) into n from public.jam_members where event_id=p_event and role=p_role and email<>p_email;
 if n>=(case when p_role='judge' then 5 else 10 end) then raise exception 'Límite de accesos: 10 organizadores y 5 jueces por evento'; end if;
 insert into public.jam_members values(p_event,p_email,trim(p_name),p_role) on conflict(event_id,email) do update set name=excluded.name,role=excluded.role;
 update public.jam_events set revision=revision+1 where id=p_event;
end $$;
create function public.jam_remove_member(p_event uuid,p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.jam_is_organizer(p_event) then raise exception 'Sin permisos' using errcode='42501'; end if;
 perform 1 from public.jam_events where id=p_event for update;
 if exists(select 1 from public.jam_events e join auth.users u on u.id=e.owner_id where e.id=p_event and lower(u.email)=lower(p_email)) then raise exception 'No se puede quitar al anfitrión propietario'; end if;
 delete from public.jam_members where event_id=p_event and email=lower(p_email);
 update public.jam_events set revision=revision+1 where id=p_event;
end $$;
create function public.jam_save_evaluation(p_event uuid,p_team text,p_scores jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.jam_events where id=p_event for update;
 if not public.jam_is_judge(p_event) then raise exception 'Solo un juez asignado puede calificar' using errcode='42501'; end if;
 if not public.jam_valid_scores(p_scores) then raise exception 'La rúbrica requiere 21 valores enteros dentro de sus límites'; end if;
 if not exists(select 1 from public.jam_state s,jsonb_array_elements(s.value) t where s.event_id=p_event and s.key='gj-teams' and t->>'code'=p_team) then raise exception 'Equipo no registrado en este evento'; end if;
 insert into public.jam_evaluations(event_id,judge_id,judge_email,team_code,scores) values(p_event,auth.uid(),lower(auth.jwt()->>'email'),p_team,p_scores)
 on conflict(event_id,judge_id,team_code) do update set scores=excluded.scores,judge_email=excluded.judge_email,updated_at=now();
 update public.jam_events set revision=revision+1 where id=p_event;
end $$;
create function public.jam_ranking(p_event uuid) returns table(team_code text,jury_average numeric,judge_count bigint,total numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.jam_is_member(p_event) then raise exception 'Sin permisos' using errcode='42501'; end if;
 return query with teams as (
  select t->>'code' as code,(t->>'votes')::numeric as votes from public.jam_state s,jsonb_array_elements(s.value) t where s.event_id=p_event and s.key='gj-teams'
 ), juries as (
  select ev.team_code,avg(ev.total) as avg_score,count(*) as n from public.jam_evaluations ev where ev.event_id=p_event
  and exists(select 1 from public.jam_members m where m.event_id=p_event and m.role='judge' and m.email=ev.judge_email) group by ev.team_code
 ), weight as (select coalesce((select s.value::text::numeric from public.jam_state s where s.event_id=p_event and s.key='gj-weight'),85) as w)
 select t.code,coalesce(j.avg_score,0),coalesce(j.n,0),coalesce(j.avg_score,0)*w.w/100 + (case when (select max(votes) from teams)>0 then t.votes/(select max(votes) from teams)*120 else 0 end)*(100-w.w)/100
 from teams t left join juries j on j.team_code=t.code cross join weight w order by 4 desc,t.code;
end $$;
-- Postgres grants new functions to PUBLIC by default. Explicitly remove that grant.
revoke all on function public.jam_is_organizer(uuid),public.jam_is_member(uuid),public.jam_is_judge(uuid),public.jam_valid_scores(jsonb),public.jam_score_total(jsonb),public.jam_create_event(text,jsonb),public.jam_save_state(uuid,text,jsonb,integer),public.jam_set_member(uuid,text,text,text),public.jam_remove_member(uuid,text),public.jam_save_evaluation(uuid,text,jsonb),public.jam_ranking(uuid) from public,anon;
grant execute on function public.jam_is_organizer(uuid),public.jam_is_member(uuid),public.jam_is_judge(uuid),public.jam_create_event(text,jsonb),public.jam_save_state(uuid,text,jsonb,integer),public.jam_set_member(uuid,text,text,text),public.jam_remove_member(uuid,text),public.jam_save_evaluation(uuid,text,jsonb),public.jam_ranking(uuid) to authenticated;
commit;

notify pgrst, 'reload schema';
