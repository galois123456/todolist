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
