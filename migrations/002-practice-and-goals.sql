-- ================================================================
-- 002 - Wrong-answer practice and student goals
-- ================================================================

alter table public.profiles
  add column if not exists target_score int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_target_score_check'
  ) then
    alter table public.profiles
      add constraint profiles_target_score_check
      check (target_score is null or target_score between 400 and 1600);
  end if;
end $$;

create table if not exists public.practice_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen int,
  chosen_text text,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now()
);

alter table public.practice_events enable row level security;

drop policy if exists "practice_events_student_read_own" on public.practice_events;
drop policy if exists "practice_events_admin_read" on public.practice_events;

create policy "practice_events_student_read_own" on public.practice_events
  for select using (student_id = auth.uid());

create policy "practice_events_admin_read" on public.practice_events
  for select using (public.is_admin());

create index if not exists practice_events_student_answered_idx
  on public.practice_events(student_id, answered_at desc);

create index if not exists practice_events_student_question_idx
  on public.practice_events(student_id, question_id, answered_at desc);

create or replace function public.get_mistake_questions()
returns table (
  question_id uuid,
  section text,
  module_key text,
  difficulty text,
  topic text,
  stem text,
  image_url text,
  choices jsonb,
  answer_type text,
  last_missed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with missed as (
    select
      aa.question_id,
      max(a.submitted_at) as last_missed_at
    from public.attempt_answers aa
    join public.test_attempts a on a.id = aa.attempt_id
    where a.student_id = auth.uid()
      and a.status = 'submitted'
      and aa.is_correct is false
    group by aa.question_id
  )
  select
    q.id,
    q.section,
    q.module_key,
    q.difficulty,
    q.topic,
    q.stem,
    q.image_url,
    q.choices,
    q.answer_type,
    m.last_missed_at
  from missed m
  join public.questions q on q.id = m.question_id
  order by m.last_missed_at desc, q.order_num asc;
end;
$$;

create or replace function public.check_practice_answer(
  p_question_id uuid,
  p_chosen int default null,
  p_chosen_text text default null
)
returns table (
  is_correct boolean,
  correct int,
  answer_text text,
  explanation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions;
  v_is_correct boolean := false;
  v_chosen_text text := nullif(trim(coalesce(p_chosen_text, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select q.*
  into v_question
  from public.questions q
  where q.id = p_question_id
    and exists (
      select 1
      from public.attempt_answers aa
      join public.test_attempts a on a.id = aa.attempt_id
      where aa.question_id = q.id
        and aa.is_correct is false
        and a.student_id = auth.uid()
        and a.status = 'submitted'
    );

  if not found then
    raise exception 'Practice question not available';
  end if;

  if v_question.answer_type = 'spr' then
    v_is_correct := public.sat_spr_is_correct(v_chosen_text, v_question.answer_text);
  else
    v_is_correct := p_chosen is not null and p_chosen = v_question.correct;
  end if;

  insert into public.practice_events (
    student_id,
    question_id,
    chosen,
    chosen_text,
    is_correct
  )
  values (
    auth.uid(),
    p_question_id,
    case when v_question.answer_type = 'spr' then null else p_chosen end,
    case when v_question.answer_type = 'spr' then v_chosen_text else null end,
    v_is_correct
  );

  return query
  select
    v_is_correct,
    v_question.correct,
    v_question.answer_text,
    v_question.explanation;
end;
$$;

create or replace function public.set_target_score(p_target_score int)
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

  if p_target_score is not null and (p_target_score < 400 or p_target_score > 1600) then
    raise exception 'Target score must be between 400 and 1600';
  end if;

  update public.profiles
  set target_score = p_target_score
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on public.practice_events from anon, authenticated;
grant select on public.practice_events to authenticated;
grant execute on function public.get_mistake_questions() to authenticated;
grant execute on function public.check_practice_answer(uuid, int, text) to authenticated;
grant execute on function public.set_target_score(int) to authenticated;

grant select (target_score) on public.profiles to authenticated;
