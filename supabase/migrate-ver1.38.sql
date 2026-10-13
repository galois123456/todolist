-- 메모 숨김 상태 저장: 기존 메모는 모두 일반 메모함으로 유지됩니다.
alter table public.todo_notes add column if not exists is_hidden boolean not null default false;
notify pgrst, 'reload schema';
