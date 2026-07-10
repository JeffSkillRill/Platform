-- ================================================================
-- 001 - Student-produced response answers and per-question timing
-- ================================================================

alter table public.questions
  add column if not exists answer_type text not null default 'mcq',
  add column if not exists answer_text text;

do $$
begin
  alter table public.questions drop constraint if exists questions_correct_check;
  alter table public.questions alter column correct drop not null;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_answer_type_check'
  ) then
    alter table public.questions
      add constraint questions_answer_type_check
      check (answer_type in ('mcq', 'spr'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname = 'questions_correct_nullable_check'
  ) then
    alter table public.questions
      add constraint questions_correct_nullable_check
      check (correct is null or correct between 0 and 3);
  end if;
end $$;

alter table public.attempt_answers
  add column if not exists chosen_text text,
  add column if not exists time_spent int not null default 0;

create or replace function public.sat_answer_to_numeric(p_text text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text := trim(coalesce(p_text, ''));
  v_parts text[];
  v_denominator numeric;
begin
  if v_text = '' then
    return null;
  end if;

  v_text := regexp_replace(v_text, '^\+', '');

  if v_text ~ '^-?(\d+(\.\d*)?|\.\d+)$' then
    return v_text::numeric;
  end if;

  if v_text ~ '^-?\d+/\d+$' then
    v_parts := string_to_array(v_text, '/');
    v_denominator := v_parts[2]::numeric;
    if v_denominator = 0 then
      return null;
    end if;
    return v_parts[1]::numeric / v_denominator;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.sat_spr_is_correct(
  p_response text,
  p_accepted_answers text
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_response text := lower(trim(coalesce(p_response, '')));
  v_response_num numeric := public.sat_answer_to_numeric(p_response);
  v_answer text;
  v_answer_num numeric;
begin
  if v_response = '' or p_accepted_answers is null then
    return false;
  end if;

  for v_answer in
    select lower(trim(value))
    from regexp_split_to_table(p_accepted_answers, ',') as value
  loop
    if v_answer = '' then
      continue;
    end if;

    if v_response = v_answer then
      return true;
    end if;

    v_answer_num := public.sat_answer_to_numeric(v_answer);
    if v_response_num is not null
       and v_answer_num is not null
       and abs(v_response_num - v_answer_num) <= 0.001 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

drop view if exists public.student_questions;
create view public.student_questions
with (security_invoker = true)
as
select
  q.id,
  q.test_id,
  q.section,
  q.module_key,
  q.difficulty,
  q.topic,
  q.stem,
  q.image_url,
  q.choices,
  q.answer_type,
  q.order_num
from public.questions q
join public.tests t on t.id = q.test_id
where t.status = 'published';

drop function if exists public.submit_attempt(uuid, jsonb, int);
create or replace function public.submit_attempt(
  p_attempt_id uuid,
  p_answers jsonb,
  p_time_taken int,
  p_question_times jsonb default '{}'::jsonb
)
returns public.test_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.test_attempts;
  v_total int := 0;
  v_correct int := 0;
  v_rw_total int := 0;
  v_math_total int := 0;
  v_rw_correct int := 0;
  v_math_correct int := 0;
  v_rw_score int := 200;
  v_math_score int := 200;
  v_question record;
  v_raw text;
  v_chosen int;
  v_chosen_text text;
  v_is_correct boolean;
  v_time_spent int;
begin
  select *
  into v_attempt
  from public.test_attempts
  where id = p_attempt_id
    and student_id = auth.uid()
    and status = 'in_progress'
  for update;

  if not found then
    raise exception 'Attempt not found or already submitted';
  end if;

  delete from public.attempt_answers where attempt_id = p_attempt_id;

  for v_question in
    select id, section, answer_type, correct, answer_text
    from public.questions
    where test_id = v_attempt.test_id
  loop
    v_total := v_total + 1;
    if v_question.section = 'rw' then
      v_rw_total := v_rw_total + 1;
    else
      v_math_total := v_math_total + 1;
    end if;

    v_raw := nullif(trim(coalesce(p_answers ->> v_question.id::text, '')), '');
    v_chosen := null;
    v_chosen_text := null;
    v_is_correct := false;

    if v_question.answer_type = 'spr' then
      v_chosen_text := v_raw;
      v_is_correct := public.sat_spr_is_correct(v_chosen_text, v_question.answer_text);
    else
      begin
        v_chosen := nullif(v_raw, 'null')::int;
      exception when others then
        v_chosen := null;
      end;
      v_is_correct := v_chosen is not null and v_chosen = v_question.correct;
    end if;

    begin
      v_time_spent := least(300, greatest(0, coalesce((p_question_times ->> v_question.id::text)::int, 0)));
    exception when others then
      v_time_spent := 0;
    end;

    insert into public.attempt_answers (
      attempt_id,
      question_id,
      chosen,
      chosen_text,
      is_correct,
      time_spent
    )
    values (
      p_attempt_id,
      v_question.id,
      v_chosen,
      v_chosen_text,
      v_is_correct,
      v_time_spent
    );

    if v_is_correct then
      v_correct := v_correct + 1;
      if v_question.section = 'rw' then
        v_rw_correct := v_rw_correct + 1;
      else
        v_math_correct := v_math_correct + 1;
      end if;
    end if;
  end loop;

  if v_rw_total > 0 then
    v_rw_score := 200 + round((v_rw_correct::numeric / v_rw_total::numeric) * 600);
  end if;

  if v_math_total > 0 then
    v_math_score := 200 + round((v_math_correct::numeric / v_math_total::numeric) * 600);
  end if;

  update public.test_attempts
  set
    status = 'submitted',
    answers = p_answers,
    time_taken = greatest(p_time_taken, 0),
    correct_count = v_correct,
    total_questions = v_total,
    rw_raw = v_rw_correct,
    math_raw = v_math_correct,
    rw_score = v_rw_score,
    math_score = v_math_score,
    total_score = v_rw_score + v_math_score,
    submitted_at = now()
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

drop function if exists public.get_attempt_review(uuid);
create function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  section text,
  module_key text,
  difficulty text,
  topic text,
  order_num int,
  stem text,
  image_url text,
  choices jsonb,
  answer_type text,
  correct int,
  answer_text text,
  explanation text,
  chosen int,
  chosen_text text,
  is_correct boolean,
  time_spent int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.test_attempts a
    where a.id = p_attempt_id
      and a.status = 'submitted'
      and (a.student_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Review not available';
  end if;

  return query
  select
    q.id,
    q.section,
    q.module_key,
    q.difficulty,
    q.topic,
    q.order_num,
    q.stem,
    q.image_url,
    q.choices,
    q.answer_type,
    q.correct,
    q.answer_text,
    q.explanation,
    aa.chosen,
    aa.chosen_text,
    aa.is_correct,
    aa.time_spent
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id
  where aa.attempt_id = p_attempt_id
  order by q.order_num;
end;
$$;

alter table public.attempt_answers enable row level security;
drop policy if exists "attempt_answers_admin_read" on public.attempt_answers;
drop policy if exists "attempt_answers_student_own" on public.attempt_answers;
create policy "attempt_answers_admin_read" on public.attempt_answers
  for select using (public.is_admin());
create policy "attempt_answers_student_own" on public.attempt_answers
  for select using (
    exists (
      select 1
      from public.test_attempts a
      where a.id = attempt_answers.attempt_id
        and a.student_id = auth.uid()
    )
  );

revoke all on public.questions from anon, authenticated;
grant select (
  id,
  test_id,
  section,
  module_key,
  difficulty,
  topic,
  stem,
  image_url,
  choices,
  answer_type,
  order_num,
  created_at
) on public.questions to authenticated;
grant insert, update, delete on public.questions to authenticated;

grant select on public.student_questions to authenticated;
grant execute on function public.sat_answer_to_numeric(text) to authenticated;
grant execute on function public.sat_spr_is_correct(text, text) to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb, int, jsonb) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
