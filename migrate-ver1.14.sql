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
