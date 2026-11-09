-- ver1.44까지 누적 SQL. 신규 설치 또는 필요한 SQL이 누락된 프로젝트에서 실행합니다.
-- 이미 ver1.44 SQL을 적용한 프로젝트는 ver1.45 업데이트에 SQL 실행이 필요 없습니다.
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

-- 계정별 필터·테마 저장. 기존 일정·시간표·습관 데이터는 변경하지 않습니다.
begin;
create table if not exists public.todo_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object' and octet_length(settings::text)<20000),
 updated_at timestamptz not null default now()
);
alter table public.todo_preferences enable row level security;
revoke all on public.todo_preferences from anon,authenticated;
grant select,insert,update,delete on public.todo_preferences to authenticated;
drop policy if exists todo_preferences_own on public.todo_preferences;
create policy todo_preferences_own on public.todo_preferences for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create or replace function public.save_todo_preferences(p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Invalid settings';end if;
 insert into public.todo_preferences(user_id,settings) values(auth.uid(),p_patch)
 on conflict(user_id) do update set settings=todo_preferences.settings || excluded.settings,updated_at=now()
 returning settings into result;
 return result;
end;
$$;
revoke all on function public.save_todo_preferences(jsonb) from public,anon;
grant execute on function public.save_todo_preferences(jsonb) to authenticated;
commit;
notify pgrst,'reload schema';

-- 메모 16색 및 글자 서식. 기존 메모와 다른 앱 테이블은 유지합니다.
begin;
alter table public.todo_notes drop constraint if exists todo_notes_color_check;
alter table public.todo_notes add constraint todo_notes_color_check
 check (color in ('yellow','orange','pink','red','blue','sky','teal','green','lime','purple','indigo','brown','cream','white','gray','black'));
alter table public.todo_notes add column if not exists text_style jsonb not null default '{}'::jsonb;
alter table public.todo_notes drop constraint if exists todo_notes_text_style_check;
alter table public.todo_notes add constraint todo_notes_text_style_check
 check (jsonb_typeof(text_style) = 'object' and octet_length(text_style::text) <= 1024);
commit;
notify pgrst, 'reload schema';

-- 메모 숨김 상태 저장: 기존 메모는 모두 일반 메모함으로 유지됩니다.
alter table public.todo_notes add column if not exists is_hidden boolean not null default false;
notify pgrst, 'reload schema';

-- ver1.43 메모함 구조 누적분
-- 기존 일정·시간표·습관 테이블은 변경하지 않습니다.
begin;

create table if not exists public.todo_note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  legacy_key text check (legacy_key in ('general','hidden')),
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name),
  unique (user_id, legacy_key)
);
alter table public.todo_note_folders enable row level security;
revoke all on public.todo_note_folders from public, anon, authenticated;
grant select, insert, update, delete on public.todo_note_folders to authenticated;
drop policy if exists "note_folders_own" on public.todo_note_folders;
create policy "note_folders_own" on public.todo_note_folders
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.todo_notes add column if not exists folder_id uuid;

-- 최초 전환 시에만 두 메모함을 생성. 재실행해도 이름을 덮거나 삭제한 메모함을 복구하지 않음.
insert into public.todo_note_folders (user_id, name, legacy_key)
select distinct n.user_id, x.name, x.legacy_key
from public.todo_notes n
cross join (values ('일반 메모함','general'), ('숨김 메모함','hidden')) x(name,legacy_key)
where n.folder_id is null
on conflict (user_id, legacy_key) do nothing;

update public.todo_notes n set folder_id = f.id
from public.todo_note_folders f
where n.folder_id is null and f.user_id = n.user_id
  and f.legacy_key = case when n.is_hidden then 'hidden' else 'general' end;

alter table public.todo_notes alter column folder_id set not null;
-- 다른 사용자의 메모함으로 이동 방지. 메모함과 안의 메모는 하나의 트랜잭션으로 삭제.
alter table public.todo_notes drop constraint if exists todo_notes_folder_owner_fk;
alter table public.todo_notes add constraint todo_notes_folder_owner_fk
  foreign key (user_id, folder_id) references public.todo_note_folders(user_id, id) on delete cascade;
create index if not exists todo_notes_folder_created on public.todo_notes(user_id,folder_id,created_at desc);

-- is_hidden은 구버전 데이터 보존을 위해 남겨 두지만 ver1.43에서는 분류에 사용하지 않습니다.
notify pgrst, 'reload schema';
commit;

-- ver1.44 메모·메모함 순서 구조 누적분. 기존 본문·색상·작성일을 보존합니다.
begin;

alter table public.todo_note_folders add column if not exists sort_order bigint;
alter table public.todo_notes add column if not exists sort_order bigint;
with ranked as (
  select id, row_number() over(partition by user_id order by created_at, id) n
  from public.todo_note_folders
)
update public.todo_note_folders f set sort_order = r.n from ranked r
where f.id = r.id and f.sort_order is null;
with ranked as (
  select id, row_number() over(partition by user_id, folder_id order by created_at desc, id desc) n
  from public.todo_notes
)
update public.todo_notes f set sort_order = r.n from ranked r
where f.id = r.id and f.sort_order is null;

-- 순서 변경 RPC와 생성/메모함 이동은 같은 계정 단위 잠금을 공유합니다.
-- 기존 ver1.43에서 만든 메모도 새 순서와 충돌하지 않도록 서버에서 순서를 부여합니다.
-- 행 잠금을 얻기 전에 계정 잠금을 잡아 자동 저장/이동/삭제와의 잠금 순서도 통일합니다.
create or replace function public.todo_lock_note_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('todo-note-order:' || auth.uid()::text, 0));
  end if;
  return null;
end;
$$;
revoke all on function public.todo_lock_note_order() from public, anon;
grant execute on function public.todo_lock_note_order() to authenticated;
drop trigger if exists todo_folder_order_lock on public.todo_note_folders;
create trigger todo_folder_order_lock before insert or update or delete on public.todo_note_folders
  for each statement execute function public.todo_lock_note_order();
drop trigger if exists todo_note_order_lock on public.todo_notes;
create trigger todo_note_order_lock before insert or update or delete on public.todo_notes
  for each statement execute function public.todo_lock_note_order();
create or replace function public.todo_assign_note_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('todo-note-order:' || new.user_id::text, 0));
  if tg_table_name = 'todo_note_folders' then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
      from public.todo_note_folders where user_id = new.user_id;
  elsif tg_op = 'INSERT' then
    select coalesce(min(sort_order), 1) - 1 into new.sort_order
      from public.todo_notes where user_id = new.user_id and folder_id = new.folder_id;
  elsif new.folder_id is distinct from old.folder_id then
    select coalesce(min(sort_order), 1) - 1 into new.sort_order
      from public.todo_notes where user_id = new.user_id and folder_id = new.folder_id;
  end if;
  return new;
end;
$$;
revoke all on function public.todo_assign_note_order() from public, anon;
grant execute on function public.todo_assign_note_order() to authenticated;
drop trigger if exists todo_folder_order_insert on public.todo_note_folders;
create trigger todo_folder_order_insert before insert on public.todo_note_folders
  for each row execute function public.todo_assign_note_order();
drop trigger if exists todo_note_order_write on public.todo_notes;
create trigger todo_note_order_write before insert or update of folder_id on public.todo_notes
  for each row execute function public.todo_assign_note_order();
alter table public.todo_note_folders alter column sort_order set not null;
alter table public.todo_notes alter column sort_order set not null;
create index if not exists todo_folders_manual_order on public.todo_note_folders(user_id,sort_order,id);
create index if not exists todo_notes_manual_order on public.todo_notes(user_id,folder_id,sort_order,id);

-- null folder_id = 메모함 순서; 지정된 folder_id = 해당 메모함 안의 메모 순서.
-- 전체 순서를 하나의 트랜잭션으로 저장하고, 오래된 화면에서 덮어쓰는 것을 방지합니다.
create or replace function public.todo_set_note_order(p_folder_id uuid, p_ids uuid[], p_expected_ids uuid[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_current uuid[];
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_ids is null or p_expected_ids is null then
    raise exception 'Invalid order' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('todo-note-order:' || v_uid::text, 0));
  if p_folder_id is null then
    perform id from public.todo_note_folders where user_id = v_uid order by id for update;
    select coalesce(array_agg(id order by sort_order, created_at, id), '{}'::uuid[]) into v_current
      from public.todo_note_folders where user_id = v_uid;
  else
    perform id from public.todo_note_folders where user_id = v_uid and id = p_folder_id for update;
    if not found then raise exception '메모함이 변경되었습니다. 다시 불러오세요.' using errcode = '40001'; end if;
    perform id from public.todo_notes where user_id = v_uid and folder_id = p_folder_id order by id for update;
    select coalesce(array_agg(id order by sort_order, created_at desc, id desc), '{}'::uuid[]) into v_current
      from public.todo_notes where user_id = v_uid and folder_id = p_folder_id;
  end if;
  if v_current is distinct from p_expected_ids then
    raise exception '다른 기기에서 목록 또는 순서가 변경되었습니다. 다시 불러온 뒤 시도하세요.' using errcode = '40001';
  end if;
  if cardinality(p_ids) <> cardinality(v_current)
    or exists(select 1 from unnest(p_ids) x where x is null)
    or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
    or not (p_ids @> v_current and v_current @> p_ids) then
    raise exception 'Invalid order' using errcode = '22023';
  end if;
  if p_folder_id is null then
    update public.todo_note_folders f set sort_order = x.n
      from unnest(p_ids) with ordinality x(id,n) where f.id = x.id and f.user_id = v_uid;
  else
    update public.todo_notes f set sort_order = x.n
      from unnest(p_ids) with ordinality x(id,n) where f.id = x.id and f.user_id = v_uid and f.folder_id = p_folder_id;
  end if;
  return jsonb_build_object('ids',p_ids);
end;
$$;
revoke all on function public.todo_set_note_order(uuid,uuid[],uuid[]) from public, anon;
grant execute on function public.todo_set_note_order(uuid,uuid[],uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
