-- 두 앱을 하나의 Supabase 프로젝트에 설치하는 통합 SQL.
-- 기존 데이터는 삭제하지 않습니다. 새 프로젝트의 SQL Editor에서 전체를 한 번 실행하세요.
begin;

-- Supabase SQL Editor에서 한 번 실행합니다. 재실행할 수 있도록 작성했습니다.
create extension if not exists pgcrypto;

create table if not exists public.todo_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
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

-- Supabase SQL Editor에서 전체 실행. 기존 표에 다시 실행해도 데이터는 유지됩니다.
create extension if not exists pgcrypto;

create table if not exists public.habit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  unit text not null default '' check (char_length(unit) <= 24),
  daily_goal numeric not null default 1 check (daily_goal >= 0),
  item_type text not null default 'Number' check (item_type in ('Number','Boolean')),
  number_mode text not null default 'Accumulate' check (number_mode in ('Accumulate','Record')),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, name),
  unique(id, user_id)
);

create table if not exists public.habit_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  item_id uuid not null,
  value numeric not null check (value >= 0 and value <= 1000000000),
  updated_at timestamptz not null default now(),
  primary key(user_id, day, item_id),
  foreign key(item_id, user_id) references public.habit_items(id, user_id) on delete cascade
);

create table if not exists public.habit_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  memo text not null default '' check (char_length(memo) <= 5000),
  updated_at timestamptz not null default now(),
  primary key(user_id, day)
);

create index if not exists habit_entries_user_day on public.habit_entries(user_id, day desc);
create index if not exists habit_notes_user_day on public.habit_notes(user_id, day desc);

alter table public.habit_items enable row level security;
alter table public.habit_entries enable row level security;
alter table public.habit_notes enable row level security;

drop policy if exists "own items" on public.habit_items;
create policy "own items" on public.habit_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "own entries" on public.habit_entries;
create policy "own entries" on public.habit_entries for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "own notes" on public.habit_notes;
create policy "own notes" on public.habit_notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.habit_items, public.habit_entries, public.habit_notes from anon;
grant select, insert, update, delete on public.habit_items, public.habit_entries, public.habit_notes to authenticated;

-- 한 번의 입력을 트랜잭션으로 처리. 합산형은 DB에서 원자적으로 더합니다.
create or replace function public.add_daily_entries(p_day date, p_values jsonb, p_memo text default '')
returns void language plpgsql security invoker set search_path = '' as $$
declare
  row_value jsonb;
  owner_id uuid := (select auth.uid());
  entry_id uuid;
  entry_value numeric;
  mode text;
  kind text;
begin
  if owner_id is null then raise exception '로그인이 필요합니다.'; end if;
  if p_day is null or p_day > (now() at time zone 'Asia/Seoul')::date then
    raise exception '오늘 또는 이전 날짜만 입력할 수 있습니다.';
  end if;
  if jsonb_typeof(p_values) <> 'array' then raise exception '기록 형식이 올바르지 않습니다.'; end if;
  if char_length(coalesce(p_memo,'')) > 5000 then raise exception '메모가 너무 깁니다.'; end if;
  if (select count(*) <> count(distinct v->>'id') from jsonb_array_elements(p_values) v) then
    raise exception '중복된 항목이 있습니다.';
  end if;
  for row_value in select * from jsonb_array_elements(p_values) loop
    entry_id := (row_value->>'id')::uuid;
    entry_value := (row_value->>'value')::numeric;
    if entry_value is null or entry_value < 0 or entry_value > 1000000000 then
      raise exception '0 이상의 값을 입력하세요.';
    end if;
    select number_mode, item_type into mode, kind
      from public.habit_items where id = entry_id and user_id = owner_id and is_active;
    if not found then raise exception '사용할 수 없는 항목입니다.'; end if;
    if kind = 'Boolean' then entry_value := case when entry_value >= 1 then 1 else 0 end; end if;
    insert into public.habit_entries(user_id,day,item_id,value)
      values(owner_id,p_day,entry_id,entry_value)
    on conflict (user_id,day,item_id) do update
      set value = case when mode = 'Accumulate' and kind = 'Number'
        then public.habit_entries.value + excluded.value
        when kind = 'Boolean' then greatest(public.habit_entries.value,excluded.value)
        else excluded.value end,
        updated_at = now();
  end loop;
  if trim(coalesce(p_memo,'')) <> '' then
    insert into public.habit_notes(user_id,day,memo)
      values(owner_id,p_day,trim(p_memo))
    on conflict (user_id,day) do update
      set memo = case when public.habit_notes.memo = '' then excluded.memo
        else public.habit_notes.memo || E'\n' || excluded.memo end,
        updated_at = now();
  end if;
end;
$$;

-- 지난 기록의 정정: 해당 날짜의 정확한 값과 메모를 한 트랜잭션에서 교체.
create or replace function public.replace_daily_entries(p_day date, p_values jsonb, p_memo text default '')
returns void language plpgsql security invoker set search_path = '' as $$
declare
  row_value jsonb;
  owner_id uuid := (select auth.uid());
  entry_id uuid;
  entry_value numeric;
  kind text;
begin
  if owner_id is null then raise exception '로그인이 필요합니다.'; end if;
  if p_day is null or p_day > (now() at time zone 'Asia/Seoul')::date then
    raise exception '오늘 또는 이전 날짜만 수정할 수 있습니다.';
  end if;
  if jsonb_typeof(p_values) <> 'array' then raise exception '기록 형식이 올바르지 않습니다.'; end if;
  if char_length(coalesce(p_memo,'')) > 5000 then raise exception '메모가 너무 깁니다.'; end if;
  if (select count(*) <> count(distinct v->>'id') from jsonb_array_elements(p_values) v) then
    raise exception '중복된 항목이 있습니다.';
  end if;
  -- 먼저 검증해 두어 잘못된 항목 하나 때문에 기존 데이터가 지워지지 않게 합니다.
  for row_value in select * from jsonb_array_elements(p_values) loop
    entry_id := (row_value->>'id')::uuid;
    entry_value := (row_value->>'value')::numeric;
    if entry_value is null or entry_value < 0 or entry_value > 1000000000 then
      raise exception '0 이상의 값을 입력하세요.';
    end if;
    select item_type into kind from public.habit_items where id = entry_id and user_id = owner_id;
    if not found then raise exception '사용할 수 없는 항목입니다.'; end if;
  end loop;
  delete from public.habit_entries where user_id = owner_id and day = p_day;
  for row_value in select * from jsonb_array_elements(p_values) loop
    entry_id := (row_value->>'id')::uuid;
    entry_value := (row_value->>'value')::numeric;
    select item_type into kind from public.habit_items where id = entry_id and user_id = owner_id;
    if kind = 'Boolean' then entry_value := case when entry_value >= 1 then 1 else 0 end; end if;
    insert into public.habit_entries(user_id,day,item_id,value)
      values(owner_id,p_day,entry_id,entry_value);
  end loop;
  if trim(coalesce(p_memo,'')) = '' then
    delete from public.habit_notes where user_id = owner_id and day = p_day;
  else
    insert into public.habit_notes(user_id,day,memo) values(owner_id,p_day,p_memo)
      on conflict (user_id,day) do update set memo = excluded.memo,updated_at = now();
  end if;
end;
$$;

revoke all on function public.add_daily_entries(date,jsonb,text) from public, anon;
revoke all on function public.replace_daily_entries(date,jsonb,text) from public, anon;
grant execute on function public.add_daily_entries(date,jsonb,text) to authenticated;
grant execute on function public.replace_daily_entries(date,jsonb,text) to authenticated;

commit;
