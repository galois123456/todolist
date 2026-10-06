-- Supabase SQL Editor에서 한 번 실행합니다. 재실행할 수 있도록 작성했습니다.
create extension if not exists pgcrypto;

create table if not exists public.todo_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text,
  created_at timestamptz not null default now(),
  unique(user_id, name),
  unique(id, user_id)
);

create table if not exists public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 10000),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  start_date date,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legacy_id text,
  constraint todo_tasks_category_owner foreign key (category_id, user_id)
    references public.todo_categories(id, user_id) on delete restrict,
  unique (user_id, legacy_id)
);

create index if not exists todo_tasks_user_due on public.todo_tasks (user_id, due_date);
create index if not exists todo_tasks_user_updated on public.todo_tasks (user_id, updated_at desc);
create index if not exists todo_categories_user on public.todo_categories (user_id);

alter table public.todo_categories enable row level security;
alter table public.todo_tasks enable row level security;
revoke all on public.todo_categories from anon, authenticated;
revoke all on public.todo_tasks from anon, authenticated;
grant select, insert, update, delete on public.todo_categories to authenticated;
grant select, insert, update, delete on public.todo_tasks to authenticated;

drop policy if exists "categories_select_own" on public.todo_categories;
drop policy if exists "categories_insert_own" on public.todo_categories;
drop policy if exists "categories_update_own" on public.todo_categories;
drop policy if exists "categories_delete_own" on public.todo_categories;
create policy "categories_select_own" on public.todo_categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.todo_categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.todo_categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.todo_categories for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "tasks_select_own" on public.todo_tasks;
drop policy if exists "tasks_insert_own" on public.todo_tasks;
drop policy if exists "tasks_update_own" on public.todo_tasks;
drop policy if exists "tasks_delete_own" on public.todo_tasks;
create policy "tasks_select_own" on public.todo_tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.todo_tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.todo_tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.todo_tasks for delete to authenticated using ((select auth.uid()) = user_id);

-- 기존 공통 Supabase 프로젝트의 SQL Editor에서 한 번 실행하세요.
-- todo_tasks에만 컬럼을 추가하며 습관 나침반 테이블과 기존 데이터는 보존합니다.
alter table public.todo_tasks add column if not exists is_lunar boolean not null default false;
alter table public.todo_tasks add column if not exists yearly_repeat boolean not null default false;
alter table public.todo_tasks add column if not exists lunar_start text;
alter table public.todo_tasks add column if not exists lunar_due text;
alter table public.todo_tasks add column if not exists lunar_leap boolean not null default false;

-- 투두·습관 테이블을 변경하지 않는 독립 메모장입니다.
create table if not exists public.todo_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  color text not null default 'yellow' check (color in ('yellow','orange','pink','blue','green','purple','cream','white')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists todo_notes_owner_created on public.todo_notes (user_id, created_at desc);
alter table public.todo_notes enable row level security;
revoke all on public.todo_notes from anon, authenticated;
grant select, insert, update, delete on public.todo_notes to authenticated;
drop policy if exists "notes_select_own" on public.todo_notes;
drop policy if exists "notes_insert_own" on public.todo_notes;
drop policy if exists "notes_update_own" on public.todo_notes;
drop policy if exists "notes_delete_own" on public.todo_notes;
create policy "notes_select_own" on public.todo_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.todo_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.todo_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.todo_notes for delete to authenticated using ((select auth.uid()) = user_id);

-- 기존 일정과 습관 데이터는 유지합니다. SQL Editor에서 한 번 실행하세요.
begin;
alter table public.todo_tasks add column if not exists start_time time;
alter table public.todo_tasks add column if not exists due_time time;
create table if not exists public.todo_timetables (
 user_id uuid primary key references auth.users(id) on delete cascade,
 template jsonb not null default '{"rows":[]}'::jsonb check (jsonb_typeof(template->'rows')='array' and jsonb_array_length(template->'rows') <= 100),
 updated_at timestamptz not null default now()
);
create table if not exists public.todo_timetable_details (
 user_id uuid not null references auth.users(id) on delete cascade,
 row_id uuid not null,
 entry_date date not null,
 body text not null default '' check (char_length(body)<=10000),
 updated_at timestamptz not null default now(),
 primary key(user_id,row_id,entry_date)
);
create index if not exists todo_timetable_details_week on public.todo_timetable_details(user_id,entry_date);
alter table public.todo_timetables enable row level security;
alter table public.todo_timetable_details enable row level security;
revoke all on public.todo_timetables,public.todo_timetable_details from anon,authenticated;
grant select,insert,update,delete on public.todo_timetables,public.todo_timetable_details to authenticated;
drop policy if exists timetable_own on public.todo_timetables;
create policy timetable_own on public.todo_timetables for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists timetable_details_own on public.todo_timetable_details;
create policy timetable_details_own on public.todo_timetable_details for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
commit;

-- 메모장 내용을 유지하고 공통 16색 저장을 허용합니다.
begin;
alter table public.todo_notes drop constraint if exists todo_notes_color_check;
alter table public.todo_notes add constraint todo_notes_color_check check (color in ('yellow','orange','pink','red','blue','sky','teal','green','lime','purple','indigo','brown','cream','white','gray','black'));
commit;


-- ver1.23: 시간표 삭제
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

-- 기존 Supabase 프로젝트의 SQL Editor에서 한 번 실행하세요.
-- 일정의 첨부 자료만 추가합니다. 기존 일정·시간표·습관 데이터는 유지합니다.
begin;
alter table public.todo_tasks add column if not exists attachments jsonb not null default '{"links":[],"photos":[]}'::jsonb;
alter table public.todo_tasks drop constraint if exists todo_tasks_attachments_shape;
alter table public.todo_tasks add constraint todo_tasks_attachments_shape check (
  jsonb_typeof(attachments) = 'object'
  and attachments ? 'links' and attachments ? 'photos'
  and jsonb_typeof(attachments->'links') = 'array'
  and jsonb_typeof(attachments->'photos') = 'array'
  and jsonb_array_length(attachments->'links') <= 50
  and jsonb_array_length(attachments->'photos') <= 20
  and octet_length(attachments::text) <= 9000000
);
commit;
notify pgrst, 'reload schema';
