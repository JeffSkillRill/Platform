# Prompt for Codex — Student Experience Upgrades for SAT Platform

Copy everything below into Codex.

---

Implement the following student-facing features, in phase order. Preserve the existing security model: students never receive `correct`, `explanation`, or accepted answers before committing an answer — everything sensitive goes through security-definer RPCs. For each schema change, produce a migration file `migrations/00X-<name>.sql` (idempotent, with RLS policies). Update README as you go.

## Phase 1 — Test-day realism (Bluebook-style tools in student-test-solve)

1. **Answer eliminator (strikethrough).** Toggle button "ABC̶" in the question header. When on, each choice gets a small strike icon; clicking it crosses out that choice (gray + line-through) without selecting it. Eliminations stored per question in the existing localStorage progress object; restored on resume. Selecting an eliminated choice un-eliminates it.
2. **Hide/show timer.** Small eye icon next to the timer; hides digits (timer keeps running). Persist preference in localStorage. Timer force-shows automatically at 5:00 remaining, like the real exam.
3. **Built-in calculator for Math modules.** A movable/collapsible panel with the free Desmos graphing calculator embedded (`https://www.desmos.com/calculator` in an iframe, lazy-loaded on first open). Show the calculator button ONLY when the active module's section is `math`.
4. **Math reference sheet.** Modal with the official SAT formula sheet (draw it as HTML/SVG — areas, volumes, Pythagorean, special triangles, etc.). Button visible in math modules only.
5. **Line reader / zoom.** A text-size toggle (3 steps) applied to `.q-stem` and `.choice-text`; persist in localStorage.
6. **Keyboard shortcuts.** 1–4 or A–D select a choice, ←/→ navigate, F toggles flag. Add a small "?" shortcut hint popover. Ignore keystrokes when a modal/calculator is open.
7. **Student-produced response (grid-in) math questions.**
   - Migration: `questions.answer_type text not null default 'mcq' check (answer_type in ('mcq','spr'))`, `questions.answer_text text` (accepted answers, comma-separated, e.g. `3/4,0.75,.75`); make `correct` nullable and drop/re-add the `between 0 and 3` check to allow null for spr; update `student_questions` view (exclude `answer_text`); update `submit_attempt()` and `get_attempt_review()` to grade spr answers (numeric-equivalence compare: trim, allow fraction `a/b` vs decimal within 0.001) and return `answer_text` only in review; `attempt_answers.chosen_text text` column.
   - Solver: for `answer_type='spr'`, render a single input (max 6 chars, digits, `.`, `/`, `-`) with the SAT preview of the entered value; store in `answers` as string.
   - Builder (admin-test-builder.js): question-type toggle MCQ/SPR; SPR hides choices and shows accepted-answers input.
   - Results page: render the student's entered text and accepted answers.

## Phase 2 — Learning & analytics

8. **Per-question time tracking.** Solver records seconds spent per question (accumulate on navigation, cap outliers at 300s) into the progress object; pass `p_question_times jsonb` to `submit_attempt()`; store in `attempt_answers.time_spent int`. `get_attempt_review()` returns it. Results page shows time per question and flags questions >90s.
9. **Skills breakdown on results page.** After the summary card, add "Performance by topic": group review rows by `topic` (fallback "General") within each section — bar per topic with correct/total and percentage, color-coded (≥80% green, 50–79% amber, <50% red). Also a difficulty breakdown (easy/medium/hard). Pure client-side from `get_attempt_review()` data — no schema change.
10. **Score trend chart on student-home.** Replace or augment the "Improvement" stat with an inline SVG line chart of `total_score` over submitted attempts (last 10), with rw/math split on hover/tap. No external chart lib; ~1600 scale y-axis.
11. **Wrong-answer practice ("My mistakes").** New page `student-practice.html` + JS/CSS:
    - Migration: RPC `get_mistake_questions()` (security definer) returning the student's incorrectly-answered question ids + stem/choices/section/topic (NO correct answer) from their submitted attempts, deduplicated, newest first; RPC `check_practice_answer(p_question_id uuid, p_chosen int, p_chosen_text text)` returning `{is_correct, correct, explanation}` — server-side check so answers stay secret until the student commits an answer; log each check into a `practice_events` table (student_id, question_id, is_correct, answered_at) with student-own RLS.
    - UI: untimed, one question at a time, "Check" button → instant feedback with explanation, "Next". Filters: section, topic. Progress line "You've cleared X of Y mistakes" (cleared = last practice event correct).
    - Add "Practice" item to the student sidebar on all student pages.
12. **Goal setting.** Migration: `profiles.target_score int check (target_score between 400 and 1600)`. Student-home: clicking the score ring opens a small modal to set a target; ring shows best score vs target (second, thinner arc) and text "220 points to your 1450 goal". Students can update their own `target_score` (RLS already allows self-update; add column to the update policy's allowed columns if column-level grants are used).

## Phase 3 — Motivation

13. **Streaks & activity.** Derive from existing data (attempts + practice_events timestamps) — no new tables: student-home shows "X-day study streak" chip (consecutive calendar days with ≥1 attempt or ≥5 practice checks). Compute client-side from the student's own rows.
14. **Badges.** Static rule-based (no schema): e.g. First Test, 1200 Club, 1400 Club, Perfect Module, Comeback (+100 vs first attempt), Mistake Crusher (50 practice clears). Render earned/locked badges in a strip on student-home; compute from the student's attempts/practice data. Keep it one small `js/badges.js` with a rules array.
15. **Leaderboard upgrades (student-leaderboard.js).** Add period filter (All time / This month / This week, on `submitted_at`), a test filter preselected from `?testId=` (the link already passes it — currently ignored, fix that), and a podium header for the top 3. Keep using the existing `leaderboard_attempts`/`leaderboard_profiles` views.
16. **Assignment due dates.** `test_assignments.due_at` already exists in schema. Student-tests + student-home: show "Due <date>" badge (red when <48h, "Overdue" after). Admin: due-date input when assigning (admin side minimal — just support the column). Sort test list by due date first.

## Phase 4 — UX & access

17. **Dark mode.** Add `[data-theme="dark"]` variable overrides in `css/base.css`-equivalent (create one shared token file if still per-page), toggle in sidebar, persist in localStorage, respect `prefers-color-scheme` default. Exclude the test-solve page header timer colors from contrast regressions.
18. **Mobile pass.** Ensure student-test-solve is usable at 375px: collapsible question grid (bottom sheet), sticky timer bar, ≥44px touch targets on choices; verify all student pages at 375/768.
19. **Score report export.** "Download report" button on results page → print-optimized view (`@media print` stylesheet: summary, section scores, topic breakdown, no sidebar) and trigger `window.print()`. No PDF library.
20. **i18n scaffold (optional, last).** Extract student-facing strings into `js/i18n.js` dictionaries (`en`, `uz`, `ru`), language switcher in sidebar, persist in localStorage. English complete; other languages can start partial with English fallback.

## Rules

- Vanilla JS/HTML/CSS only, no build step, no frameworks; Desmos iframe is the only external embed.
- Never expose `correct`, `explanation`, or `answer_text` to students except via the two review/check RPCs after an answer is committed.
- Escape every db-sourced string with `window.escapeHtml`; use `window.safeImageUrl` for images; prefer `data-` attributes + `addEventListener` over inline onclick for new code.
- Every migration idempotent (`if not exists` / `create or replace`), includes RLS, and is listed in README with run order.
- After each phase, state what was changed and how to test it manually.

## Acceptance checks

- [ ] Eliminator, timer-hide, zoom, and shortcuts all survive a page reload mid-test.
- [ ] Calculator/reference appear only in math modules; Desmos loads only when opened.
- [ ] An SPR question grades `3/4`, `0.75`, and `.75` as the same answer, server-side.
- [ ] Network tab never shows `correct`/`answer_text` during a test or during practice before "Check".
- [ ] Results page shows topic + difficulty + time-per-question breakdowns for a fresh attempt.
- [ ] Mistake practice only shows the logged-in student's own missed questions.
- [ ] Leaderboard `?testId=` deep link preselects that test's board.
- [ ] Dark mode + mobile verified on every student page.
