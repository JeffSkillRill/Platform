-- ================================================================
-- SAT Practice Test A — SPR (grid-in) add-on
-- ================================================================
-- RUN THIS ONLY AFTER Codex has implemented CODEX-FEATURES.md
-- Phase 1, item 7 (student-produced response questions), which adds:
--   questions.answer_type  text check in ('mcq','spr'), default 'mcq'
--   questions.answer_text  text  (comma-separated accepted answers)
--   questions.correct      made nullable for spr questions
--
-- This script converts 10 questions in "SAT Practice Test A
-- (Full-Length)" — 5 per math module — from multiple choice to
-- typed-answer (grid-in), matching the real digital SAT mix
-- (about 25% of math questions are student-produced response).
--
-- It refuses to run (with a clear message) if the SPR migration
-- has not been applied yet. Safe to re-run.
-- ================================================================

do $$
declare
  v_test_id uuid;
  v_converted int := 0;
begin
  -- Preflight: make sure the SPR migration exists
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'answer_type'
  ) then
    raise exception 'Column public.questions.answer_type not found. Apply the SPR migration (CODEX-FEATURES.md Phase 1, item 7) before running this script.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'questions' and column_name = 'answer_text'
  ) then
    raise exception 'Column public.questions.answer_text not found. Apply the SPR migration (CODEX-FEATURES.md Phase 1, item 7) before running this script.';
  end if;

  select id into v_test_id
  from public.tests
  where name = 'SAT Practice Test A (Full-Length)';

  if v_test_id is null then
    raise exception 'SAT Practice Test A (Full-Length) not found. Run seed-practice-test-A.sql first.';
  end if;

  -- ==============================================================
  -- MATH MODULE 1 — convert 5 questions (order_num 54, 59, 63, 69, 73)
  -- ==============================================================

  -- order 54: 3x + 5 = 20  ->  x = 5
  update public.questions set
    answer_type = 'spr',
    answer_text = '5',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'If 3x + 5 = 20, what is the value of x?'
  where test_id = v_test_id and order_num = 54;
  v_converted := v_converted + 1;

  -- order 59: 40 stickers in ratio 3:5, larger share -> 25
  update public.questions set
    answer_type = 'spr',
    answer_text = '25',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'Two friends split 40 stickers in the ratio 3:5. How many stickers does the friend with the larger share receive?'
  where test_id = v_test_id and order_num = 59;
  v_converted := v_converted + 1;

  -- order 63: median of 3, 7, 7, 9, 12, 15 -> 8
  update public.questions set
    answer_type = 'spr',
    answer_text = '8',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'What is the median of the data set 3, 7, 7, 9, 12, 15?'
  where test_id = v_test_id and order_num = 63;
  v_converted := v_converted + 1;

  -- order 69: sum of solutions of x^2 - 5x + 6 = 0 -> 5
  update public.questions set
    answer_type = 'spr',
    answer_text = '5',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'What is the sum of the solutions to the equation x^2 - 5x + 6 = 0?'
  where test_id = v_test_id and order_num = 69;
  v_converted := v_converted + 1;

  -- order 73: infinitely many solutions -> k = 14
  update public.questions set
    answer_type = 'spr',
    answer_text = '14',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'In the system 2x + 3y = 7 and 4x + 6y = k, for what value of k does the system have infinitely many solutions?'
  where test_id = v_test_id and order_num = 73;
  v_converted := v_converted + 1;

  -- ==============================================================
  -- MATH MODULE 2 — convert 5 questions (order_num 76, 85, 87, 95, 96)
  -- ==============================================================

  -- order 76: 5x - 4 = 21  ->  x = 5
  update public.questions set
    answer_type = 'spr',
    answer_text = '5',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'If 5x - 4 = 21, what is the value of x?'
  where test_id = v_test_id and order_num = 76;
  v_converted := v_converted + 1;

  -- order 85: weighted average of 20 students at 80 and 30 at 90 -> 86
  update public.questions set
    answer_type = 'spr',
    answer_text = '86',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'A class of 20 students has an average score of 80, and another class of 30 students has an average score of 90. What is the average score of all 50 students?'
  where test_id = v_test_id and order_num = 85;
  v_converted := v_converted + 1;

  -- order 87: sqrt(x + 7) = 4  ->  x = 9
  update public.questions set
    answer_type = 'spr',
    answer_text = '9',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'If the square root of (x + 7) equals 4, what is the value of x?'
  where test_id = v_test_id and order_num = 87;
  v_converted := v_converted + 1;

  -- order 95: pencil/pen system -> pen costs 1.30 (accept equivalent forms)
  update public.questions set
    answer_type = 'spr',
    answer_text = '1.30,1.3,13/10',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'Three pencils and two pens cost $4.70. One pencil and one pen together cost $2.00. What is the cost, in dollars, of one pen? (Enter your answer without the dollar sign.)'
  where test_id = v_test_id and order_num = 95;
  v_converted := v_converted + 1;

  -- order 96: 6 / (x - 2) = 3  ->  x = 4
  update public.questions set
    answer_type = 'spr',
    answer_text = '4',
    correct = null,
    choices = '[]'::jsonb,
    stem = 'If 6 / (x - 2) = 3, what is the value of x?'
  where test_id = v_test_id and order_num = 96;
  v_converted := v_converted + 1;

  raise notice 'Converted % questions in SAT Practice Test A to student-produced response.', v_converted;
  raise notice 'Math Module 1 grid-ins: questions at order 54, 59, 63, 69, 73.';
  raise notice 'Math Module 2 grid-ins: questions at order 76, 85, 87, 95, 96.';
end $$;
