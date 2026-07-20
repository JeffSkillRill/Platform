# Prompt for Codex — Full QA Sweep & Bug Report

Copy everything below the line into Codex. Run from the repo root.

---

You are doing an exhaustive QA pass on this SAT practice platform and producing a single bug report. This is a **read-and-test** task: find and document bugs, don't fix them unless I say so. The stack is vanilla HTML/CSS/JS (no build step) served statically, backed by Supabase (Auth, Postgres + RLS, RPC scoring, Storage). There are two portals: **Admin** and **Student**. Page map, migrations, and invariants are in `README.md`, `CODEX-NEXT-STEPS.md`, and `schema.sql` + `migrations/` — read those first so you know what "correct" means before you test.

## Ground rules

- **Do not change behavior.** You may add a throwaway static server, seed data, or test scripts, but do not edit app logic. If you must run SQL, keep it read-only unless seeding is required to reach a screen.
- **Reproduce before reporting.** Every bug needs concrete steps, the actual vs. expected result, and where it lives (file + line/function where you can identify it).
- **Test both portals and every page** in the README page map, plus every JS module in `js/`.
- **Serve it, don't just open files:** `python3 -m http.server 5173` then hit `http://localhost:5173` so relative fetches and auth work.
- Check the browser **console and network tab** on every page — log any JS errors, failed requests, 4xx/5xx, or unexpected `select=*` calls.

## Coverage — test the platform every possible way

Work through all of these and record what you find:

**1. Auth & access control (highest priority — this is a graded exam product).**
- Student login, admin login, logout, session persistence across reload, expired/invalid session handling.
- `js/auth-guard.js`: try to reach every protected admin page while logged out, and while logged in as a *student*. Confirm role is enforced server-side (RLS), not just by hiding UI. Try direct URL access and direct Supabase REST calls with a student token.
- **Answer-leak checks (critical):** confirm `correct`, `answer_text`, and `explanation` are NOT retrievable before an answer is committed — via the network tab, direct REST queries against `questions`/`student_questions`, and `get_attempt_review()` before submission. This is the core integrity property of the product.

**2. Full student journey.**
- Login → dashboard → start Test A → all 4 modules including SPR grid-in questions → answer-eliminator → calculator (Desmos) → reference sheet → hide/show timer → text-size change → keyboard shortcuts → **reload mid-test and confirm exact state resumes** → submit → results (per-question time, slow-question labels, topic bars, difficulty bars) → practice mistakes (missed questions show *without* answers until Check) → vocabulary quiz → question bank session → leaderboard.
- SPR grading edge cases: fractions vs decimals (`3/4`, `0.75`, `.75`), negative numbers, values out of range, leading/trailing spaces, blank submit, more than 5 chars.
- Timer edge cases: what happens at 0:00, on tab-switch/background, on reload near expiry.

**3. Full admin journey.**
- Create student (Edge Function `create-student`) → create class → add member → test builder: create test, add MCQ + SPR questions, attach images, set topic/difficulty/explanation, publish, assign to a class → leaderboard → dashboard stats → students list → question bank → vocabulary admin.
- Test builder validation: missing fields, no correct answer set, malformed SPR accepted-answers, publishing an empty test, duplicate assignment.

**4. Data integrity & edge inputs.**
- XSS: put `<script>`, `"><img onerror>`, and markup into every free-text field (student name, class name, question stem, explanation, vocabulary word). Confirm `window.escapeHtml` is applied to all DB-sourced strings on render.
- Empty states: brand-new student with no tests, class with no members, test with no questions, leaderboard with no attempts, results before any submission.
- Boundary/large inputs: very long strings, unicode/emoji, SQL-ish input, negative/zero/huge numeric fields (target score, exam date in the past/far future).
- Concurrency: submit the same attempt twice, double-click submit, open the same test in two tabs.

**5. UI / responsive / accessibility.**
- Every page at **375px width** and desktop; log layout breaks, overflow, overlap, unclickable controls.
- **Dark mode** toggle on every page — check contrast and any unstyled/hardcoded-color elements.
- Mobile nav (`js/mobile-nav.js`), keyboard-only navigation, focus states, alt text on images, the print/"Download report" view on results.
- Broken images, broken internal links, 404s across the whole page map.

**6. Robustness.**
- Offline / dropped network mid-action (start test, submit, save). Does it fail loudly or silently corrupt state?
- Refresh at every step of the test flow.
- Back/forward button behavior mid-test and after submit.

## Deliverable — the bug report

Write `docs/qa-bug-report.md` with:

1. **Summary table** at the top: every bug as one row — ID, title, severity (Critical / High / Medium / Low), area (Auth, Test-flow, Admin, Data, UI, Responsive, Perf), status (Confirmed / Suspected).
2. **One section per bug**, ordered by severity, each containing: description, exact reproduction steps, expected vs. actual, affected file(s)/function(s), console/network evidence, and suggested fix direction (one line — don't implement).
3. **Coverage checklist**: every item in the Coverage list above marked ✅ tested-pass, ❌ tested-fail (links to bug IDs), or ⚠️ couldn't-test (say why, e.g. needs live Supabase creds).
4. **Security findings called out separately** at the top if any answer-leak or access-control bug exists — those are release-blockers.

Severity guide: **Critical** = answer leak, auth bypass, data loss, or scoring wrong. **High** = a core journey step is broken. **Medium** = wrong-but-recoverable behavior. **Low** = cosmetic/polish.

Start by reading `README.md`, `CODEX-NEXT-STEPS.md`, `schema.sql`, and `js/auth-guard.js`, then tell me what you can and can't reach without live Supabase credentials before you begin — if the DB isn't reachable, do the full static/client-side pass and mark the server-dependent items ⚠️ with exactly what you'd need from me to finish them.
