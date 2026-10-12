-- 이전 8색 제한이 남아 있을 때만 실행해도 됩니다. 기존 메모는 유지합니다.
begin;
alter table public.todo_notes drop constraint if exists todo_notes_color_check;
alter table public.todo_notes add constraint todo_notes_color_check check (color in ('yellow','orange','pink','red','blue','sky','teal','green','lime','purple','indigo','brown','cream','white','gray','black'));
commit;
