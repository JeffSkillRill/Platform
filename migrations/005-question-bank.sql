-- ================================================================
-- 005 - Question Bank practice sessions
-- ================================================================

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  question_ids uuid[] not null default '{}',
  answered int not null default 0,
  correct int not null default 0,
  status text not null default 'active' check (status in ('active','finished')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen int,
  chosen_text text,
  is_correct boolean not null default false,
  time_spent int not null default 0,
  answered_at timestamptz not null default now(),
  unique(session_id, question_id)
);

alter table public.practice_sessions enable row level security;
alter table public.practice_answers enable row level security;

drop policy if exists "practice_sessions_student_own" on public.practice_sessions;
drop policy if exists "practice_answers_student_own" on public.practice_answers;
create policy "practice_sessions_student_own" on public.practice_sessions
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "practice_answers_student_own" on public.practice_answers
  for select using (
    exists (
      select 1 from public.practice_sessions s
      where s.id = practice_answers.session_id
        and s.student_id = auth.uid()
    )
  );

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
    );

  if not found then
    raise exception 'Question not found or not available';
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

revoke all on public.practice_sessions from authenticated;
revoke all on public.practice_answers from authenticated;
grant select, insert on public.practice_sessions to authenticated;
grant select on public.practice_answers to authenticated;
grant execute on function public.get_bank_stats() to authenticated;
grant execute on function public.check_practice_answer(uuid, uuid, int, text, int) to authenticated;
