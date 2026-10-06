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
