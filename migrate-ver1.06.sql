-- 기존 업무와 습관 데이터는 변경하지 않습니다.
alter table public.todo_categories add column if not exists color text;
