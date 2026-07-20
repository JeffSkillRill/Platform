-- ================================================================
-- 008 - Attempt authorization, practice answer isolation, SPR input
-- ================================================================

create or replace function public.student_has_test_access(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.tests t
      join public.test_assignments ta on ta.test_id = t.id
      where t.id = p_test_id
        and t.status = 'published'
        and (
          ta.student_id = auth.uid()
          or ta.class_id in (
            select cm.class_id
            from public.class_members cm
            where cm.student_id = auth.uid()
          )
        )
    );
$$;

revoke all on function public.student_has_test_access(uuid) from public;
grant execute on function public.student_has_test_access(uuid) to authenticated;

drop policy if exists "attempts_student_insert" on public.test_attempts;
create policy "attempts_student_insert" on public.test_attempts
  for insert with check (
    student_id = auth.uid()
    and status = 'in_progress'
    and public.student_has_test_access(test_id)
  );

create or replace function public.enforce_test_attempt_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or new.student_id <> auth.uid()
     or not public.student_has_test_access(new.test_id) then
    raise exception 'Test is not published and assigned to this student'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_test_attempt_access() from public;

drop trigger if exists test_attempt_access_guard on public.test_attempts;
create trigger test_attempt_access_guard
before insert or update of status, test_id, student_id on public.test_attempts
for each row execute function public.enforce_test_attempt_access();

create or replace function public.sat_spr_answers_valid(p_answers text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_answer text;
  v_count int := 0;
begin
  if p_answers is null or trim(p_answers) = '' then
    return false;
  end if;

  for v_answer in
    select trim(value)
    from regexp_split_to_table(p_answers, ',') as value
  loop
    v_count := v_count + 1;
    if v_answer = ''
       or length(v_answer) > 5
       or public.sat_answer_to_numeric(v_answer) is null then
      return false;
    end if;
  end loop;

  return v_count > 0;
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
  v_response_num numeric := public.sat_answer_to_numeric(p_response);
  v_answer text;
  v_answer_num numeric;
begin
  if v_response_num is null or not public.sat_spr_answers_valid(p_accepted_answers) then
    return false;
  end if;

  for v_answer in
    select trim(value)
    from regexp_split_to_table(p_accepted_answers, ',') as value
  loop
    v_answer_num := public.sat_answer_to_numeric(v_answer);
    if v_answer_num is not null
       and abs(v_response_num - v_answer_num) <= 0.001 then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

alter table public.questions
  drop constraint if exists questions_spr_answer_text_valid;
alter table public.questions
  add constraint questions_spr_answer_text_valid
  check (
    answer_type <> 'spr'
    or public.sat_spr_answers_valid(answer_text)
  ) not valid;

create or replace function public.get_bank_stats()
returns table (
  questions_available int,
  answered int,
  correct int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with available as (
    select distinct q.id
    from public.questions q
    join public.tests t on t.id = q.test_id
    join public.test_assignments ta on ta.test_id = t.id
    where t.status = 'published'
      and (
        ta.student_id = auth.uid()
        or ta.class_id in (
          select cm.class_id from public.class_members cm where cm.student_id = auth.uid()
        )
      )
      and exists (
        select 1
        from public.test_attempts a
        where a.test_id = t.id
          and a.student_id = auth.uid()
          and a.status = 'submitted'
      )
  ),
  answered_rows as (
    select pa.question_id, bool_or(pa.is_correct) as ever_correct
    from public.practice_answers pa
    join public.practice_sessions ps on ps.id = pa.session_id
    where ps.student_id = auth.uid()
    group by pa.question_id
  )
  select
    (select count(*)::int from available),
    (select count(*)::int from answered_rows),
    (select count(*)::int from answered_rows where ever_correct);
end;
$$;

create or replace function public.check_practice_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_chosen int default null,
  p_chosen_text text default null,
  p_time_spent int default 0
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
  v_session public.practice_sessions;
  v_question public.questions;
  v_is_correct boolean := false;
  v_chosen_text text := nullif(trim(coalesce(p_chosen_text, '')), '');
begin
  select * into v_session
  from public.practice_sessions
  where id = p_session_id
    and student_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'Practice session not found';
  end if;

  if not (p_question_id = any(v_session.question_ids)) then
    raise exception 'Question is not part of this session';
  end if;

  select q.* into v_question
  from public.questions q
  join public.tests t on t.id = q.test_id
  where q.id = p_question_id
    and t.status = 'published'
    and exists (
      select 1
      from public.test_assignments ta
      where ta.test_id = t.id
        and (
          ta.student_id = auth.uid()
          or ta.class_id in (
            select cm.class_id
            from public.class_members cm
            where cm.student_id = auth.uid()
          )
        )
    )
    and exists (
      select 1
      from public.test_attempts a
      where a.test_id = t.id
        and a.student_id = auth.uid()
        and a.status = 'submitted'
    );

  if not found then
    raise exception 'Question is not available for practice';
  end if;

  if v_question.answer_type = 'spr' then
    v_is_correct := public.sat_spr_is_correct(v_chosen_text, v_question.answer_text);
  else
    v_is_correct := p_chosen is not null and p_chosen = v_question.correct;
  end if;

  insert into public.practice_answers(session_id, question_id, chosen, chosen_text, is_correct, time_spent)
  values (
    p_session_id,
    p_question_id,
    case when v_question.answer_type = 'spr' then null else p_chosen end,
    case when v_question.answer_type = 'spr' then v_chosen_text else null end,
    v_is_correct,
    least(300, greatest(0, coalesce(p_time_spent, 0)))
  )
  on conflict (session_id, question_id)
  do update set
    chosen = excluded.chosen,
    chosen_text = excluded.chosen_text,
    is_correct = excluded.is_correct,
    time_spent = excluded.time_spent,
    answered_at = now();

  update public.practice_sessions
  set
    answered = (select count(*)::int from public.practice_answers where session_id = p_session_id),
    correct = (select count(*)::int from public.practice_answers where session_id = p_session_id and is_correct),
    status = case
      when (select count(*) from public.practice_answers where session_id = p_session_id) >= cardinality(question_ids)
      then 'finished'
      else status
    end,
    finished_at = case
      when (select count(*) from public.practice_answers where session_id = p_session_id) >= cardinality(question_ids)
      then now()
      else finished_at
    end
  where id = p_session_id;

  return query select v_is_correct, v_question.correct, v_question.answer_text, v_question.explanation;
end;
$$;

create or replace function public.finish_practice_session(p_session_id uuid)
returns public.practice_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.practice_sessions;
begin
  update public.practice_sessions
  set status = 'finished', finished_at = coalesce(finished_at, now())
  where id = p_session_id
    and student_id = auth.uid()
  returning * into v_session;

  if not found then
    raise exception 'Practice session not found';
  end if;

  return v_session;
end;
$$;

revoke all on function public.finish_practice_session(uuid) from public;
grant execute on function public.finish_practice_session(uuid) to authenticated;

grant execute on function public.get_bank_stats() to authenticated;
grant execute on function public.check_practice_answer(uuid, uuid, int, text, int) to authenticated;
