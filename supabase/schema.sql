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
