-- ver1.43: 메모함. 기존 ver1.42 사용자는 이 파일만 SQL Editor에서 실행하세요.
-- 신규 프로젝트는 이전버전_통합.sql 실행 후 이 파일을 실행하세요.
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
