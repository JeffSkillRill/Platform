-- 007: Recreate admin_questions so it exposes every current questions column.
--
-- Why: the live view was created by schema.sql BEFORE migration 001 added
-- answer_type / answer_text to public.questions. PostgreSQL freezes a view's
-- column list at creation time, so on deployed projects
--   GET /rest/v1/admin_questions?select=answer_type
-- returns 400 "column admin_questions.answer_type does not exist"
-- (verified live 2026-07-20). That breaks the Admin Question Bank page
-- outright and makes the Test Builder silently load SPR questions as empty
-- MCQs when editing an existing test.
--
-- "create or replace" cannot drop or reorder existing view columns, so the
-- view is dropped and recreated. It is a plain read-only view with no
-- dependents (nothing selects FROM admin_questions in SQL), so the drop is
-- safe; the REST grant is restored below.

drop view if exists public.admin_questions;

create view public.admin_questions as
select q.*
from public.questions q
where public.is_admin();

grant select on public.admin_questions to authenticated;

-- Verify (should return zero rows, not an error):
--   select answer_type, answer_text from public.admin_questions limit 1;
-- Or over REST with an admin session:
--   GET /rest/v1/admin_questions?select=answer_type&limit=1  -> 200
