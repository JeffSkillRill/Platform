-- ================================================================
-- 003 - Dashboard profile fields
-- ================================================================

alter table public.profiles
  add column if not exists exam_date date;

create or replace function public.set_exam_date(p_exam_date date)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set exam_date = p_exam_date
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.set_exam_date(date) to authenticated;
grant select (exam_date) on public.profiles to authenticated;

create or replace view public.test_popularity
as
select
  test_id,
  count(distinct student_id)::int as people_took
from public.test_attempts
where status = 'submitted'
group by test_id;

grant select on public.test_popularity to authenticated;
