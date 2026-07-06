-- ================================================================
-- SAT Platform Demo Test Seed
-- ================================================================
-- Paste this into Supabase SQL Editor and click Run.
-- It creates one published 98-question demo test:
--   - Reading & Writing Module 1: 27 questions
--   - Reading & Writing Module 2: 27 questions
--   - Math Module 1: 22 questions
--   - Math Module 2: 22 questions
--
-- The content is original lightweight demo content for testing the
-- platform flow. It is not an official SAT practice test.
-- ================================================================

do $$
declare
  v_test_id uuid;
  i int;
  v_order int := 0;
begin
  insert into public.tests (name, status)
  values ('SAT Platform Demo Test - 98 Questions', 'published')
  returning id into v_test_id;

  -- Reading & Writing Module 1
  for i in 1..27 loop
    insert into public.questions (
      test_id, section, module_key, difficulty, stem, choices, correct, order_num, topic, explanation
    )
    values (
      v_test_id,
      'rw',
      'rw1',
      case when i <= 9 then 'easy' when i <= 18 then 'medium' else 'hard' end,
      format(
        'R&W Module 1, Question %s. Choose the clearest and most grammatically correct version of the sentence about a student research project.',
        i
      ),
      jsonb_build_array(
        format('The students analyzes the survey results before presenting it.'),
        format('The students analyze the survey results before presenting them.'),
        format('The students, analyzing the survey results before presenting.'),
        format('The students was analyzing the survey results before presenting them.')
      ),
      1,
      v_order,
      'standard english conventions',
      'For this demo item, compare subject-verb agreement, pronoun agreement, and sentence completeness.'
    );
    v_order := v_order + 1;
  end loop;

  -- Reading & Writing Module 2
  for i in 1..27 loop
    insert into public.questions (
      test_id, section, module_key, difficulty, stem, choices, correct, order_num, topic, explanation
    )
    values (
      v_test_id,
      'rw',
      'rw2',
      case when i <= 8 then 'easy' when i <= 18 then 'medium' else 'hard' end,
      format(
        'R&W Module 2, Question %s. The experiment produced consistent results in the first trial. ___, the researchers repeated it with a larger sample to confirm the pattern. Which transition best completes the text?',
        i
      ),
      jsonb_build_array(
        'However,',
        'For example,',
        'Therefore,',
        'Meanwhile,'
      ),
      2,
      v_order,
      'transitions',
      'For this demo item, choose the transition that matches the logical relationship in the sentence.'
    );
    v_order := v_order + 1;
  end loop;

  -- Math Module 1
  for i in 1..22 loop
    insert into public.questions (
      test_id, section, module_key, difficulty, stem, choices, correct, order_num, topic, explanation
    )
    values (
      v_test_id,
      'math',
      'math1',
      case when i <= 7 then 'easy' when i <= 15 then 'medium' else 'hard' end,
      format(
        'Math Module 1, Question %s. If x + %s = %s, what is the value of x?',
        i, i + 3, (i * 2) + 7
      ),
      jsonb_build_array(
        ((i * 2) + 7) - (i + 3) - 2,
        ((i * 2) + 7) - (i + 3) - 1,
        ((i * 2) + 7) - (i + 3),
        ((i * 2) + 7) - (i + 3) + 1
      ),
      2,
      v_order,
      'linear equations',
      'Subtract the constant from both sides to isolate x.'
    );
    v_order := v_order + 1;
  end loop;

  -- Math Module 2
  for i in 1..22 loop
    insert into public.questions (
      test_id, section, module_key, difficulty, stem, choices, correct, order_num, topic, explanation
    )
    values (
      v_test_id,
      'math',
      'math2',
      case when i <= 6 then 'easy' when i <= 15 then 'medium' else 'hard' end,
      format(
        'Math Module 2, Question %s. A line has slope %s and passes through the point (0, %s). Which equation represents the line?',
        i, (i % 5) + 1, (i % 7) + 2
      ),
      jsonb_build_array(
        format('y = %sx + %s', (i % 5) + 1, (i % 7) + 2),
        format('y = %sx - %s', (i % 5) + 1, (i % 7) + 2),
        format('y = %sx + %s', (i % 7) + 2, (i % 5) + 1),
        format('x = %sy + %s', (i % 5) + 1, (i % 7) + 2)
      ),
      0,
      v_order,
      'linear functions',
      'Use slope-intercept form y = mx + b, where m is the slope and b is the y-intercept.'
    );
    v_order := v_order + 1;
  end loop;

  raise notice 'Created demo test % with id %', 'SAT Platform Demo Test - 98 Questions', v_test_id;
end $$;
