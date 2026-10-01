-- 기존 공통 Supabase 프로젝트의 SQL Editor에서 한 번 실행하세요.
-- todo_tasks에만 컬럼을 추가하며 습관 나침반 테이블과 기존 데이터는 보존합니다.
alter table public.todo_tasks add column if not exists is_lunar boolean not null default false;
alter table public.todo_tasks add column if not exists yearly_repeat boolean not null default false;
alter table public.todo_tasks add column if not exists lunar_start text;
alter table public.todo_tasks add column if not exists lunar_due text;
alter table public.todo_tasks add column if not exists lunar_leap boolean not null default false;
