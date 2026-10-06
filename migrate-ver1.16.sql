-- 메모장 내용을 유지하고 공통 16색 저장을 허용합니다.
begin;
alter table public.todo_notes drop constraint if exists todo_notes_color_check;
alter table public.todo_notes add constraint todo_notes_color_check check (color in ('yellow','orange','pink','red','blue','sky','teal','green','lime','purple','indigo','brown','cream','white','gray','black'));
commit;
