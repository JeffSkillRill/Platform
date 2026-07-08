# SAT Platform — Problems Found & Fix Instructions for Codex

Full audit of the project (12 HTML pages, 12 JS files, 13 CSS files, 3 SQL files, config files). Problems are listed first, then step-by-step instructions. Fix in the order given — security first.

---

## PART 1 — PROBLEMS FOUND

### A. Critical security problems

1. **Plain-text passwords.** `users.password` is stored and compared in plain text (schema.sql, student-login.js, admin-login.js). Admin UI even displays every student's password in a table column (admin-students.js line 122, admin-students.html line 99).
2. **Allow-all RLS.** schema.sql creates `allow_all_*` policies on all 4 tables. Combined with the public anon key, ANYONE can read/modify/delete all users (including passwords), tests, questions (including correct answers), and submissions directly via the REST API — no login needed.
3. **Login is client-side only and trivially bypassed.** Auth = writing `sat_user` to localStorage. Anyone can open DevTools, run `localStorage.setItem('sat_user', '{"id":"x","role":"admin","name":"x"}')` and become admin.
4. **Correct answers exposed to students.** Multiple student pages fetch the `questions` table with the `correct` column: student-test-solve.js (legacy fallback, line 139), student-tests.js, student-results.js, student-test-results.js (`hydrateCorrectAnswers`). A student can see all answers in the Network tab *during* the test. Deleting `correct` client-side (student-test-solve.js lines 104-106) does not help — the data already arrived in the response.
5. **Client-side scoring + open insert on `submissions`.** Anyone can POST fake submissions with perfect answers and poison the leaderboard. All scoring happens in the browser.
6. **Missing auth guards.** `admin-dashboard.js`, `admin-students.js`, and `admin-test-builder.js` have NO session/role check at all. Anyone can open those pages directly. Only admin-tests.js and admin-leaderboard.js check `session.role==='admin'` (which is forgeable anyway, see #3). Student pages check only `session.id`, never role. Also, redirect guards don't `return`/halt, so the rest of the script still executes after `window.location.href=` is set.
7. **Default admin credentials** `admin` / `admin123` seeded in schema.sql.
8. **Credentials sprawl.** The Supabase URL + anon key are hard-coded in 10 different JS files plus `Keys.txt` plus `supabase-config.js`. `Keys.txt` should not exist in the working tree at all (it is gitignored but still present on disk).
9. **schema-secure-v2.sql is written but completely unused.** The frontend never uses Supabase Auth, `profiles`, `test_attempts`, `submit_attempt()`, `get_attempt_review()`, `student_questions`, or `test_assignments`. The secure design exists on paper only.

### B. XSS vulnerabilities

10. **admin-students.js `renderTable`** injects `full_name`, `username`, `password` into innerHTML unescaped → stored XSS via a student name like `<img src=x onerror=...>`.
11. **student-tests.js** injects `t.name` unescaped into the card AND into an inline `onclick="startTest('${t.name...}')"` — a quote or `</script>`-style payload in a test name breaks/injects (the `.replace(/'/g,"\\'")` is insufficient; double quotes and HTML are unescaped).
12. **student-test-solve.js** renders `q.stem` and each choice `${c}` unescaped (lines 421-425, 445).
13. **student-test-results.js** renders `q.stem` and choices unescaped (buildCard).
14. Inconsistent escaping overall: student-home.js / student-results.js / student-leaderboard.js / admin-tests.js / admin-leaderboard.js have `esc()`/`escapeHtml()` helpers; the files above don't. Each file also re-implements its own helper.

### C. Functional bugs and logic problems

15. **Two different scoring formulas.** student-home.js scores per-section (`200 + correct/total*600`, rounded to 10) while student-results.js, student-leaderboard.js, and admin-leaderboard.js use `400 + pct*1200` flat. The server-side `submit_attempt()` in v2 uses a third variant. Same submission shows different scores on different pages.
16. **admin-tests.js "Open builder"** links to `admin-test-builder.html` with no test id — it opens whatever draft is in localStorage, not the clicked test. Existing tests can never be edited.
17. **Publish flow is unsafe.** admin-test-builder.js `publishTest()` inserts the test with `status:'published'` FIRST, then inserts up to 98 questions one-by-one sequentially (98 awaited POSTs). If any insert fails midway, students see a live, half-empty test. No transaction, no draft→publish step, very slow.
18. **Draft shape mismatch.** admin-dashboard.js `createTest()` saves `{name, questions: [], status}` but admin-test-builder.js expects `{name, moduleQuestions:{rw1,rw2,math1,math2}}` (admin-tests.js uses the correct shape). Dashboard-created drafts lose structure.
19. **admin-dashboard.js is entirely fake.** Hard-coded student list, hard-coded activity feed, hard-coded nav badges ("18" students, "6" tests in admin-dashboard.html), greeting hard-coded to "Jeff", `addStudent()` just shows an alert, `handleLogout()` just alerts "Signed out." and doesn't clear the session or redirect.
20. **Timer is cheatable.** student-test-solve.js persists `timerSecs` to localStorage every tick and restores it on reload — closing the tab pauses the exam clock indefinitely. `timeTaken` is computed from wall-clock `startTime` and includes the 10-minute break.
21. **Break button bug.** `updateBreakDisplay()` enables the "next" button when `breakSecs <= 60` (line 370-371), contradicting `startBreak()` which disables it until 0.
22. **student-home.js session guard checks `session.name`** instead of `session.id` (other pages use `.id`) — inconsistent.
23. **student-home.js total score logic**: `rw && math ? rw + math : rw || math || 0` — a single-section test yields a total on a 200–800 scale shown against a 1600 ring.
24. **Duplicate-username race** in admin-students.js: checks existence then inserts (no unique-violation handling on insert; DB does have a unique constraint, but the error path shows a generic message).
25. **Multiple submissions allowed** per student per test — no guard; every retake inserts a new `submissions` row and inflates leaderboard "attempts".
26. **Base64 images stored in `questions.image_url`** (admin-test-builder.js `handleImageUpload`) — multi-MB data-URLs in a text column, fetched by every student on every load. Should use Supabase Storage.
27. **seed-demo-test.sql doesn't match schema.sql.** The seed inserts `topic` and `explanation` columns that only exist in schema-secure-v2. Running the seed against the legacy schema (which the frontend actually uses) fails.
28. **seed uses static `format()` calls with no variables** (lines 40-43) — works but pointless; all 27 RW1 questions are identical apart from the number.
29. **stale placeholder check**: admin-students.js `checkConnection()` compares against `'YOUR_SUPABASE_URL'`, which can never match the now-hard-coded URL — dead code.
30. **getModDef mislabels partial tests**: a test with only `rw2`+`math2` questions gets labeled "Module 1 / Module 2" with wrong timing assumptions; module timing is hard-coded rather than read from the test row (v2 has `rw_minutes` etc.).

### D. Code quality / structure

31. **`supabase-config.js` is dead code** — no HTML file includes it; every JS file re-declares its own `db` helper and credentials instead. ~10 duplicated fetch-helper implementations.
32. Duplicated `esc`/`parseJson`/`get` helpers copy-pasted across 6+ files; duplicated logout, session-load, initials, date-format logic.
33. All JS is written as if inline (leading indentation from extraction), attached to `window` implicitly via `onclick="..."` globals — fragile; no modules.
34. 13 near-identical CSS files each re-declaring the same design tokens (`--teal`, `--text`, etc.) with slight drift (e.g. `--accent` only defined in student-home.css; `--text-faint` in only 7 of 13). No shared `base.css`.
35. No README, no local dev instructions, no linting, no tests.
36. Hard-coded literal strings for module structure duplicated between admin-test-builder.js (`MODULE_CONFIG`), student-test-solve.js (`SAT_MODULE_DEFS`), and student-tests.js (time estimate 64/70 min vs actual 32+32+35+35=134 min including modules — the listing underestimates by half).

---

## PART 2 — INSTRUCTIONS FOR CODEX

Work top-down. Phases 1–3 are the security migration and matter most; do not skip them for cosmetic fixes.

### Phase 1 — Migrate auth to Supabase Auth + secure schema (fixes A1–A9)

1. Adopt `schema-secure-v2.sql` as the single schema. Apply it to the Supabase project. Delete `schema.sql` (or move to `docs/legacy/`), and fix `seed-demo-test.sql` if kept (it already matches v2's columns — just verify it runs against v2 and add a `test_assignments` seeding step or an "assign-to-all" policy so students can see the demo test).
2. Rewrite both login pages to use Supabase Auth (`supabase-js` v2 via CDN, `signInWithPassword`). Usernames can be mapped to emails (`username@yourdomain`) or use a `username → email` lookup in `profiles`. Remove all plain-text password reads/compares. Remove the `users` table usage everywhere.
3. Replace localStorage `sat_user` sessions with the Supabase session (`supabase.auth.getSession()`); derive role from `profiles`. Add a shared `auth-guard.js` that every protected page includes: redirects unauthenticated users, enforces role (`admin` pages require admin), and `return`s/throws after redirect so nothing else executes. Apply it to ALL pages: admin-dashboard, admin-students, admin-test-builder, admin-tests, admin-leaderboard, student-home, student-tests, student-test-solve, student-results, student-test-results, student-leaderboard.
4. All REST calls must send the user's JWT (`Authorization: Bearer <session.access_token>`) instead of the anon key as bearer, so the v2 RLS policies actually apply.
5. Students take tests via `student_questions` view only (no `correct` in any student-visible response). Remove the legacy fallback in student-test-solve.js `loadQuestionsForSolving()`. Remove `hydrateCorrectAnswers()` from student-test-results.js and the direct `questions?select=*` fetches in student-results.js — use the `get_attempt_review()` RPC after submission instead.
6. Submissions: replace client-side insert into `submissions` with `test_attempts` + the `submit_attempt()` RPC (server-side scoring). Create an attempt row on test start; call the RPC on submit. All leaderboards/dashboards/results pages read scores from `test_attempts` columns (`total_score`, `rw_score`, `math_score`, `correct_count`) — delete all client-side scoring functions (`calculateScore`, `scoreFor`, `score`, `scoreSubmission`, `sectionScore`). This also fixes problem C15 (one scoring source of truth). If a real SAT conversion table is available, put it inside `submit_attempt()`.
7. Admin student management: creating a student = create an Auth user + `profiles` row (needs a small server-side function — use a Supabase Edge Function with the service role key; NEVER put the service key in frontend code). Remove the password column from the admin students table UI; show a one-time generated password only at creation.
8. Delete `Keys.txt`. Centralize URL + anon key in `supabase-config.js` alone, include it via `<script src="supabase-config.js">` on every page, and delete the 10 duplicated credential blocks. Rotate the anon key in the Supabase dashboard after cleanup (it's been committed).
9. Remove the seeded `admin/admin123` account; create the real admin via Supabase Auth.

### Phase 2 — Fix XSS (B10–B14)

10. Create `js/shared.js` (loaded on every page) exporting one `escapeHtml()` plus the common helpers (`parseJson`, initials, date formatting, logout). Delete the per-file copies.
11. Escape ALL user/db-sourced values before innerHTML interpolation in: admin-students.js (name, username), student-tests.js (test name — also stop passing the name through inline `onclick`; use `data-` attributes + `addEventListener`), student-test-solve.js (stem, choices, image_url — validate it's http(s) or a storage URL), student-test-results.js (stem, choices), admin-dashboard.js.
12. Prefer building DOM nodes or using `textContent` where possible; where template strings remain, every `${}` of external data goes through `escapeHtml()`.

### Phase 3 — Functional fixes (C15–C30)

13. **Test builder editing:** `admin-tests.js` "Open builder" → `admin-test-builder.html?id=<testId>`; builder loads that test's questions from DB when `id` present, saves updates (PATCH) instead of always inserting new. Keep localStorage only as an unsaved-changes cache keyed by test id.
14. **Safe publish:** create tests as `status:'draft'`, batch-insert questions (single POST with a JSON array — PostgREST supports bulk insert), and only PATCH to `published` after all questions inserted successfully. Show progress/errors properly.
15. **Unify draft shape:** admin-dashboard.js `createTest()` must write the same `{name, moduleQuestions}` shape as admin-tests.js (or better: just navigate to the builder and let it own the draft).
16. **Wire admin-dashboard.js to real data:** load counts, students, and recent attempts from Supabase; remove hard-coded student array, activity feed, nav badges (18/6), and hard-coded "Jeff" (use profile full_name). Make `addStudent()` real (same flow as admin-students) and `handleLogout()` actually `supabase.auth.signOut()` + redirect.
17. **Timer integrity:** store module deadlines server-side or at minimum derive remaining time from `started_at` + module duration on restore instead of trusting persisted `timerSecs`. Exclude break time from `time_taken`. Throttle progress saves (e.g. every 5s / on answer change), not every tick.
18. **Break screen:** remove the `breakSecs <= 60` early-enable in `updateBreakDisplay()` (keep enable-at-0 only), or if early skip is intended, make it explicit ("Skip break" button).
19. **One attempt per test (configurable):** before starting, check for an existing submitted attempt and either block or clearly mark retakes; leaderboards already take best score — make attempt counting correct.
20. **Images:** upload question images to Supabase Storage, store the public URL in `image_url`; reject the base64-in-column approach. Enforce size/type client-side and via storage policies.
21. **Module labels/timing:** derive module durations from the test row (v2 `rw_minutes`, `math_minutes`, `break_minutes`) and label modules from `module_key` actually present, not by array index. Fix student-tests.js time estimate to match real module durations.
22. Remove dead code: `checkConnection()` placeholder check, unused `modStartTimes`, the legacy question fallback.
23. student-home.js: guard on session/user id (not `.name`); fix single-section total display (show "—" for missing section instead of a fake 1600-scale total).

### Phase 4 — Structure & polish (D31–D36)

24. Extract shared CSS design tokens into `css/base.css` (`:root` variables, sidebar, buttons, toast, modal) and include it before each page stylesheet; remove drifted duplicates so vars like `--accent`, `--amber-light`, `--text-faint` are defined once for all pages.
25. Replace inline `onclick="..."` globals with `addEventListener` bindings in each JS file; wrap each file in an IIFE or use `type="module"`.
26. Normalize the shared module constants (module caps, durations, labels) into one `js/sat-config.js` used by builder, solver, and listing pages.
27. Add `README.md`: setup (Supabase project, run schema-secure-v2.sql, seed, edge function deploy), local dev (any static server), and page map.
28. Optional: add a simple CI check (eslint + html-validate).

### Acceptance checklist

- [ ] No plain-text passwords anywhere; no password ever rendered in UI or returned by API.
- [ ] With no login, REST calls to tests/questions/profiles/attempts return zero rows.
- [ ] Logged-in student's network traffic never contains `correct` or `explanation` before submission.
- [ ] Forged localStorage grants nothing (server enforces via RLS/JWT).
- [ ] Same attempt shows the identical score on home, results, both leaderboards.
- [ ] Admin can edit an existing test; publishing is atomic (draft until complete).
- [ ] `<script>alert(1)</script>` as a student name or test name renders as text everywhere.
- [ ] Closing the tab mid-test does not extend the module timer.
- [ ] One shared config/helpers file; anon key appears in exactly one file; `Keys.txt` deleted and key rotated.
