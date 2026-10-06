-- Supabase SQL Editor에서 한 번 실행하세요.
-- 이 SQL 자체는 기존 데이터를 삭제하지 않습니다.
-- 앱에서 시간표 삭제를 확인할 때 설정과 해당 세부사항을 한 트랜잭션으로 삭제합니다.
begin;
create or replace function public.save_todo_timetables(
  p_template jsonb,
  p_deleted_schedule_ids text[]
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_previous jsonb;
  v_schedules jsonb;
  v_row_ids uuid[];
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_template->'schedules') is distinct from 'array' then
    raise exception '시간표 설정 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_template->'schedules') as item
    where item->>'id' = any(coalesce(p_deleted_schedule_ids, array[]::text[]))
  ) then
    raise exception '삭제한 시간표가 저장할 목록에 남아 있습니다.' using errcode = '22023';
  end if;

  insert into public.todo_timetables(user_id, template)
  values(v_user_id, '{"rows":[]}'::jsonb)
  on conflict(user_id) do nothing;

  select template into v_previous from public.todo_timetables
  where user_id = v_user_id for update;

  -- 예전 단일 시간표도 기본 시간표 ID로 처리합니다.
  v_schedules := case when jsonb_typeof(v_previous->'schedules') = 'array'
    then v_previous->'schedules'
    else jsonb_build_array(jsonb_build_object('id','default','rows',coalesce(v_previous->'rows','[]'::jsonb))) end;

  -- 삭제할 행 ID는 클라이언트 값 대신 본인에게 저장된 시간표에서 얻습니다.
  select array_agg(distinct (period->>'id')::uuid) into v_row_ids
  from jsonb_array_elements(v_schedules) as schedule
  cross join lateral jsonb_array_elements(schedule->'rows') as period
  where schedule->>'id' = any(coalesce(p_deleted_schedule_ids, array[]::text[]));

  delete from public.todo_timetable_details
  where user_id = v_user_id and row_id = any(coalesce(v_row_ids,array[]::uuid[]));

  update public.todo_timetables
  set template = p_template, updated_at = now()
  where user_id = v_user_id;
end;
$$;
revoke all on function public.save_todo_timetables(jsonb,text[]) from public, anon;
grant execute on function public.save_todo_timetables(jsonb,text[]) to authenticated;
commit;
