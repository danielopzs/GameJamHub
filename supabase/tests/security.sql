-- Disposable PostgreSQL only: auth.uid/auth.jwt are stubbed by bootstrap.sql.
-- These tests use the real authenticated database role, not the postgres owner.
begin;
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','owner@example.test'),
 ('00000000-0000-0000-0000-000000000002','judge1@example.test'),
 ('00000000-0000-0000-0000-000000000003','judge2@example.test'),
 ('00000000-0000-0000-0000-000000000004','outsider@example.test');
create temp table test_events(id uuid);
grant all on test_events to authenticated;
create function pg_temp.expect_failure(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;
 exception when others then
  if position(expected in sqlerrm)>0 then return; end if;
  raise exception 'Unexpected failure: %, wanted: %',sqlerrm,expected;
 end;
 raise exception 'Command should have failed: %',command;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@example.test"}',true);
insert into test_events select public.jam_create_event('Evento de prueba','{"gj-event":{"name":"Evento de prueba"},"gj-host":{"email":"private@example.test"},"gj-teams":[{"code":"T01","name":"Equipo 1","game":"Juego 1","votes":10},{"code":"T02","name":"Equipo 2","game":"Juego 2","votes":0}],"gj-weight":85}');
select public.jam_set_member(id,'judge1@example.test','Juez 1','judge') from test_events;
select public.jam_set_member(id,'judge2@example.test','Juez 2','judge') from test_events;
select public.jam_set_member(id,'judge3@example.test','Juez 3','judge') from test_events;
select public.jam_set_member(id,'judge4@example.test','Juez 4','judge') from test_events;
select public.jam_set_member(id,'judge5@example.test','Juez 5','judge') from test_events;
select pg_temp.expect_failure(format('select public.jam_set_member(%L,''judge6@example.test'',''Juez 6'',''judge'')',id),'Límite de accesos') from test_events;
select public.jam_save_state(id,'gj-weight','90',1) from test_events;
select pg_temp.expect_failure(format('select public.jam_save_state(%L,''gj-weight'',''80'',1)',id),'CONFLICT') from test_events;
select public.jam_save_state(id,'gj-weight','85',2) from test_events;
select pg_temp.expect_failure(format('select public.jam_save_state(%L,''gj-members'',%L,0)',id,(select jsonb_agg(jsonb_build_object('name','Miembro')) from generate_series(1,11))),'Máximo 10') from test_events;
select pg_temp.expect_failure(format('select public.jam_save_state(%L,''gj-participants'',%L,0)',id,(select jsonb_agg(jsonb_build_object('id',i,'name','Participante','checkedIn',false)) from generate_series(1,101)i)),'Máximo 100') from test_events;
select public.jam_save_state(id,'gj-participants',(select jsonb_agg(jsonb_build_object('id',i,'name','Participante','checkedIn',false)) from generate_series(1,100)i),0) from test_events;
select public.jam_create_event('Edición '||i,'{}') from generate_series(2,6)i;
select pg_temp.expect_failure('select public.jam_create_event(''Séptimo evento'',''{}'')','hasta 6 eventos');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","email":"judge1@example.test"}',true);
do $$ begin
 if(select count(*) from public.jam_events)<>1 then raise exception 'RLS: el juez puede ver eventos ajenos';end if;
 if(select count(*) from public.jam_state where key='gj-host')<>0 then raise exception 'RLS: el juez puede leer datos privados del anfitrión';end if;
 if(select count(*) from public.jam_members)<>1 then raise exception 'RLS: un juez puede leer el directorio privado de accesos';end if;
end $$;
select pg_temp.expect_failure(format('select public.jam_save_state(%L,''gj-weight'',''1'',3)',id),'Sin permisos') from test_events;
select pg_temp.expect_failure(format('select public.jam_set_member(%L,''intruder@example.test'',''Intruso'',''organizer'')',id),'Sin permisos') from test_events;
select pg_temp.expect_failure(format('update public.jam_state set value=''0'' where event_id=%L',id),'permission denied') from test_events;
select pg_temp.expect_failure(format('select public.jam_save_evaluation(%L,''UNKNOWN'',''[10,10,5,5,5,5,5,5,10,5,5,5,5,10,10,5,5,2,2,2,4]'')',id),'Equipo no registrado') from test_events;
select pg_temp.expect_failure(format('select public.jam_save_evaluation(%L,''T01'',''[11,10,5,5,5,5,5,5,10,5,5,5,5,10,10,5,5,2,2,2,4]'')',id),'21 valores') from test_events;
select pg_temp.expect_failure(format('select public.jam_save_evaluation(%L,''T01'',''[]'')',id),'21 valores') from test_events;
select public.jam_save_evaluation(id,'T01','[10,10,5,5,5,5,5,5,10,5,5,5,5,10,10,5,5,2,2,2,4]') from test_events;
select public.jam_save_evaluation(id,'T01','[10,10,5,5,5,5,5,5,10,5,5,5,5,10,10,5,5,2,2,2,4]') from test_events;
do $$ begin if(select count(*) from public.jam_evaluations)<>1 then raise exception 'No se deduplicó la evaluación';end if;end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","email":"judge2@example.test"}',true);
do $$ begin if(select count(*) from public.jam_evaluations)<>0 then raise exception 'RLS: el juez puede leer evaluaciones ajenas';end if;end $$;
select public.jam_save_evaluation(id,'T01','[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]') from test_events;
do $$ declare row record;begin
 select * into row from public.jam_ranking((select id from test_events)) where team_code='T01';
 if row.jury_average<>60 or row.judge_count<>2 or row.total<>69 then raise exception 'Promedio / ponderación incorrectos: %',row;end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000004","email":"outsider@example.test"}',true);
do $$ begin
 if(select count(*) from public.jam_events)<>0 or(select count(*) from public.jam_state)<>0 or(select count(*) from public.jam_evaluations)<>0 then raise exception 'RLS: usuario ajeno puede leer datos';end if;
end $$;
select pg_temp.expect_failure(format('select * from public.jam_ranking(%L)',id),'Sin permisos') from test_events;
select pg_temp.expect_failure(format('select public.jam_save_evaluation(%L,''T01'',''[]'')',id),'Solo un juez') from test_events;
reset role;
set local role anon;
select pg_temp.expect_failure('select * from public.jam_events','permission denied');
select pg_temp.expect_failure('select public.jam_create_event(''Intrusión'',''{}'')','permission denied');
reset role;
rollback;
select 'PASS: quotas, RLS isolation, judge identity, validation, deduplication, weighting and conflict protection' as result;
