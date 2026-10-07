-- 계정별 필터·테마 저장. 기존 일정·시간표·습관 데이터는 변경하지 않습니다.
begin;
create table if not exists public.todo_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object' and octet_length(settings::text)<20000),
 updated_at timestamptz not null default now()
);
alter table public.todo_preferences enable row level security;
revoke all on public.todo_preferences from anon,authenticated;
grant select,insert,update,delete on public.todo_preferences to authenticated;
drop policy if exists todo_preferences_own on public.todo_preferences;
create policy todo_preferences_own on public.todo_preferences for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create or replace function public.save_todo_preferences(p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501';end if;
 if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Invalid settings';end if;
 insert into public.todo_preferences(user_id,settings) values(auth.uid(),p_patch)
 on conflict(user_id) do update set settings=todo_preferences.settings || excluded.settings,updated_at=now()
 returning settings into result;
 return result;
end;
$$;
revoke all on function public.save_todo_preferences(jsonb) from public,anon;
grant execute on function public.save_todo_preferences(jsonb) to authenticated;
commit;
notify pgrst,'reload schema';
