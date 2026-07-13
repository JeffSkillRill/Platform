# Prompt for Codex — Next Steps (Launch Readiness → Admin Tools → Communication)

Copy everything below into Codex.

---

The platform is feature-complete for v1: secure auth/RLS, full test flow with SPR grid-ins and exam tools, mistakes practice, classes, question bank sessions, vocabulary, streaks/badges, dark mode. Work through the phases below in order. Keep all existing invariants: server-side grading via RPCs, no `correct`/`answer_text`/`explanation` exposed before an answer is committed, `window.escapeHtml` on all db-sourced strings, vanilla HTML/CSS/JS with no build step, idempotent migrations with RLS.

## Phase 1 — Launch readiness (do first)

1. **Docs sync.** README is stale: it lists only migrations 001–002 and the old page map. Update it to cover migrations 001–006 (with one-line descriptions and run order), the full current page map (classes, question bank, vocabulary, practice, both portals), the seed files (`seed-demo-test.sql`, `seed-practice-test-A.sql`, `seed-practice-test-A-spr-gridin.sql` and their order), the theme toggle, and the Edge Function. Add a short "Deploy" section (below).
2. **Migration verifier.** Create `migrations/verify.sql`: a single read-only script that checks every expected table, column, view, RPC, and policy from schema + 001–006 exists, and outputs a PASS/FAIL row per item (use `select ... union all`). Purpose: run in Supabase SQL Editor to confirm the DB matches the code before launch.
3. **Deployment prep (Cloudflare Pages).** Add `docs/deploy.md`: connect the GitHub repo to Cloudflare Pages (no build command, output dir `/`), set the custom domain, then in Supabase Auth → URL Configuration add the production URL to Site URL and redirect allow-list. Include the anon-key rotation step (the old key was committed publicly — rotate in Supabase dashboard, update `supabase-config.js`, redeploy). Add `_headers` file for Pages with sensible security headers (X-Frame-Options: DENY except where needed, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, and a CSP that allows self + fonts.googleapis/gstatic + the Supabase project domain + Desmos iframe).
4. **QA sweep.** Walk the full student journey (login → dashboard → start Test A → all 4 modules incl. SPR questions, eliminator, calculator, reload-resume → submit → results with topic breakdown → practice mistakes → vocabulary quiz → question bank session) and the full admin journey (create student → create class → add member → build/publish test with class assignment → review leaderboards). Fix every bug found; list each fix in the final report. Verify all pages at 375px width and in dark mode; fix layout breaks.

## Phase 2 — Admin quality of life

5. **Question Bank admin page is a read-only stub — make it real.** `admin-question-bank.html/js`: search box (stem text), filters (section, topic, difficulty, answer type, test), pagination (50/page). Row actions: edit (opens a proper editor modal reusing test-builder form patterns: stem, topic, difficulty, choices/SPR answers, explanation, image), delete (with confirm; block or warn if the question has attempt answers). Add "duplicate to another test" action.
6. **Bulk question import.** In the test builder, add "Import questions" accepting a JSON file (documented schema in `docs/question-import.md`: array of {section, module_key, difficulty, topic, stem, choices, correct, answer_type, answer_text, explanation}). Validate every row client-side (report row-level errors before inserting), then batch-insert. Include a downloadable example file `docs/question-import-example.json`.
7. **Student detail view for admins.** From admin-students, clicking a student opens `admin-student-detail.html`: profile info, class memberships, attempts table (score, date, time, link to review via existing admin review access), topic-level accuracy aggregates, practice activity summary. Read-only; reuse existing RPCs/views where possible, add a security-definer RPC if aggregates need one (admin-only check inside).

## Phase 3 — Class communication (the planned teacher–student channel)

8. **Announcements (one-way, build now).** Migration `007-announcements.sql`: `class_announcements(id, class_id, author_id, title, body, created_at, updated_at)` + `announcement_reads(announcement_id, student_id, read_at, unique pair)`. RLS: admins full; class members read their classes'' announcements and insert their own read receipts. Admin UI: compose/edit/delete announcements inside the class detail page. Student UI: announcements feed inside My Learning Space class card with unread badge in the sidebar nav (count of unread announcements); mark-as-read on open.
9. **Design for two-way messaging but do NOT build it yet.** Add `docs/messaging-design.md`: proposed schema (`class_threads`, `thread_messages` with sender, RLS sketch), moderation considerations, and how announcements migrate into it. No code.

## Phase 4 — Reach & polish

10. **i18n (English / Uzbek / Russian).** `js/i18n.js` with `t(key)` and three dictionaries; language switcher in both sidebars (persist in localStorage, default from `navigator.language`). Translate all student-facing UI strings (exam content stays as authored). English complete; uz/ru complete for navigation, dashboard, test flow, results, practice, vocabulary, question bank; fall back to English for anything missed. Do not translate admin pages in this pass.
11. **Scalability guards.** Add `limit`/pagination or range headers to unbounded reads (leaderboard views, submissions/attempts lists, vocabulary words, question bank counts). Leaderboards: cap to top 100 + always include the current student''s row. Confirm no page fetches `questions?select=*` without a test filter.
12. **Student settings.** Small settings area (modal or page): change password (Supabase `auth.updateUser`), exam date, target score, language, theme — one place instead of scattered controls. Keep the existing dashboard entry points working.

## Rules

- After each phase: stop, summarize what changed, list any migrations to run and manual steps for the owner (deploys, dashboard settings), then continue.
- Never regress the visual design: everything stays in the original teal design language and existing CSS patterns.
- Every new table ships with RLS in the same migration. Every new admin capability is enforced by RLS/RPC checks, not by UI hiding.

## Acceptance checks

- [ ] `migrations/verify.sql` passes on the production Supabase project.
- [ ] Platform live on Cloudflare Pages with rotated anon key; login + full test flow works on the production URL.
- [ ] README accurately describes every migration, page, and seed in the repo.
- [ ] Admin can search/edit/delete/import questions outside the test builder.
- [ ] Teacher posts an announcement → student sees unread badge, reads it, badge clears; non-members see nothing.
- [ ] Language switcher renders the student portal in uz/ru with no broken layouts.
- [ ] No unbounded table reads remain; 375px + dark mode verified on all pages.
