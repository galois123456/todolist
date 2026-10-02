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
