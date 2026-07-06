-- ================================================================
-- SAT Platform - Secure Supabase Schema v2
-- ================================================================
-- Use this for the next migration after moving login to Supabase Auth.
-- It replaces the legacy browser-password model in schema.sql.
--
-- Important:
-- 1. Create Admin/Student accounts in Supabase Auth first.
-- 2. Insert matching rows into public.profiles.
-- 3. Update the frontend to send the Supabase Auth JWT.
-- 4. Then remove/stop using the legacy public.users password table.
-- ================================================================

create extension if not exists pgcrypto;

-- ---------- Helpers ----------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- ---------- Users / Roles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  username      text unique not null,
  role          text not null default 'student' check (role in ('admin', 'student')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ---------- Tests ----------
create table if not exists public.tests (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by      uuid references public.profiles(id) on delete set null,
  rw_minutes      int not null default 64,
  math_minutes    int not null default 70,
  break_minutes   int not null default 10,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.test_assignments (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at      timestamptz,
  unique (test_id, student_id)
);

-- ---------- Questions ----------
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id) on delete cascade,
  section     text not null check (section in ('math', 'rw')),
  module_key  text not null check (module_key in ('rw1', 'rw2', 'math1', 'math2')),
  difficulty  text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  topic       text,
  stem        text not null,
  image_url   text,
  choices     jsonb not null,
  correct     int not null check (correct between 0 and 3),
  explanation text,
  order_num   int not null default 0,
  created_at  timestamptz not null default now(),
  unique (test_id, module_key, order_num)
);

-- Student-facing question view. It intentionally excludes "correct" and "explanation".
create or replace view public.student_questions
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
  q.order_num
from public.questions q
join public.tests t on t.id = q.test_id
where t.status = 'published';

-- Admin-facing question view. Students can query it, but it returns no rows
-- unless their authenticated profile role is admin.
create or replace view public.admin_questions
as
select q.*
from public.questions q
where public.is_admin();

-- ---------- Attempts / Analytics ----------
create table if not exists public.test_attempts (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  test_id        uuid not null references public.tests(id) on delete cascade,
  status         text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  answers        jsonb not null default '{}'::jsonb,
  time_taken     int not null default 0,
  correct_count  int,
  total_questions int,
  rw_raw         int,
  math_raw       int,
  rw_score       int,
  math_score     int,
  total_score    int,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  unique (student_id, test_id, started_at)
);

create table if not exists public.attempt_answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  chosen      int check (chosen between 0 and 3),
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_tests_status on public.tests(status);
create index if not exists idx_questions_test_order on public.questions(test_id, order_num);
create index if not exists idx_assignments_student on public.test_assignments(student_id);
create index if not exists idx_attempts_student on public.test_attempts(student_id, submitted_at desc);
create index if not exists idx_attempts_test_score on public.test_attempts(test_id, total_score desc);

-- ---------- Server-side submit ----------
-- This uses a simple placeholder scale so dashboards can work now.
-- Replace the scaling formula with your real SAT conversion table later.
create or replace function public.submit_attempt(
  p_attempt_id uuid,
  p_answers jsonb,
  p_time_taken int
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
  v_chosen int;
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
    select id, section, correct
    from public.questions
    where test_id = v_attempt.test_id
  loop
    v_total := v_total + 1;
    if v_question.section = 'rw' then
      v_rw_total := v_rw_total + 1;
    else
      v_math_total := v_math_total + 1;
    end if;

    v_chosen := nullif(p_answers ->> v_question.id::text, 'null')::int;

    insert into public.attempt_answers (attempt_id, question_id, chosen, is_correct)
    values (
      p_attempt_id,
      v_question.id,
      v_chosen,
      case when v_chosen is null then false else v_chosen = v_question.correct end
    );

    if v_chosen = v_question.correct then
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

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  section text,
  module_key text,
  order_num int,
  stem text,
  image_url text,
  choices jsonb,
  correct int,
  explanation text,
  chosen int,
  is_correct boolean
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
    q.order_num,
    q.stem,
    q.image_url,
    q.choices,
    q.correct,
    q.explanation,
    aa.chosen,
    aa.is_correct
  from public.attempt_answers aa
  join public.questions q on q.id = aa.question_id
  where aa.attempt_id = p_attempt_id
  order by q.order_num;
end;
$$;

grant execute on function public.submit_attempt(uuid, jsonb, int) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.test_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.attempt_answers enable row level security;

drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "tests_admin_all" on public.tests;
drop policy if exists "tests_students_assigned_published" on public.tests;
create policy "tests_admin_all" on public.tests
  for all using (public.is_admin()) with check (public.is_admin());
create policy "tests_students_assigned_published" on public.tests
  for select using (
    status = 'published'
    and exists (
      select 1
      from public.test_assignments ta
      where ta.test_id = tests.id
        and ta.student_id = auth.uid()
    )
  );

drop policy if exists "assignments_admin_all" on public.test_assignments;
drop policy if exists "assignments_student_read" on public.test_assignments;
create policy "assignments_admin_all" on public.test_assignments
  for all using (public.is_admin()) with check (public.is_admin());
create policy "assignments_student_read" on public.test_assignments
  for select using (student_id = auth.uid());

drop policy if exists "questions_admin_all" on public.questions;
drop policy if exists "questions_students_assigned_published" on public.questions;
create policy "questions_admin_all" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "questions_students_assigned_published" on public.questions
  for select using (
    exists (
      select 1
      from public.tests t
      join public.test_assignments ta on ta.test_id = t.id
      where t.id = questions.test_id
        and t.status = 'published'
        and ta.student_id = auth.uid()
    )
  );

drop policy if exists "attempts_admin_read" on public.test_attempts;
drop policy if exists "attempts_student_own" on public.test_attempts;
create policy "attempts_admin_read" on public.test_attempts
  for select using (public.is_admin());
create policy "attempts_student_own" on public.test_attempts
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

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

-- Column grants keep the correct answer hidden from direct student question reads.
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
  order_num,
  created_at
) on public.questions to authenticated;

grant select on public.student_questions to authenticated;
grant select on public.admin_questions to authenticated;

grant select, insert, update, delete on public.tests to authenticated;
grant select, insert, update, delete on public.test_assignments to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.questions to authenticated;
grant select, insert, update on public.test_attempts to authenticated;
grant select on public.attempt_answers to authenticated;
