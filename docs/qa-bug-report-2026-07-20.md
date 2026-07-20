# QA Bug Report — Uncommitted Changes Review (2026-07-20)

**Scope.** Full review of the working tree before commit: the 8 modified files (`index.html`, `css/index.css`, `js/admin-login.js`, `js/student-login.js`, `js/admin-test-builder.js`, `js/shared.js`, `js/student-practice.js`, `js/student-test-solve.js`), the new `_headers` file, plus a re-check of the still-open items from the previous report (`docs/qa-bug-report.md`, 2026-07-13).

**Method.** Static code review of the full diff, `node --check` on all 27 JS files (all pass), live browser testing at `http://localhost:5173` (homepage desktop + 375px, login error paths, auth-guard redirects), and read-only anonymous probes against the live Supabase project.

**Nothing was committed.**

---

## Fixes applied after this report (same day, still uncommitted)

The bugs below were fixed in the working tree after the review; the sections that follow describe the state *before* those fixes and are kept for the record.

| ID | Fix | Where |
|---|---|---|
| NEW-1 | Publish now updates kept questions **in place by row id** (insert-or-update via `on_conflict=id`) instead of delete-and-recreate, so submitted attempts keep their per-question history. Only questions the admin actually removed are deleted. | `js/admin-test-builder.js` (`publishTest`, `upsertQuestions`) |
| NEW-2 | Assignments are snapshotted before replacement; on failure the snapshot is re-inserted. | `js/admin-test-builder.js` |
| NEW-3 | The test is patched to `draft` **before** any question writes and republished only at the end, so students can never load a half-updated set. | `js/admin-test-builder.js` |
| NEW-4 | Kept questions are parked at staged negative `order_num`s only transiently and renumbered to final `0…n-1` in the same flow; a publish also heals negative values left by the old code. | `js/admin-test-builder.js` |
| NEW-5 | The final publish patch retries once; every step is retry-safe (newly inserted rows adopt their DB ids, orphans from a failed run are cleaned up on the next attempt), and the failure toast now says exactly what to do. | `js/admin-test-builder.js` |
| NEW-6 | The outer login catch signs the session out again before showing the error. | `js/admin-login.js`, `js/student-login.js` |
| NEW-7 | Hero re-encoded as `assets/home-hero.jpg` (188 KB vs 1.7 MB); CSS updated. Browser-verified identical rendering. The old `home-hero.png` is now unused and can be deleted. | `css/index.css`, `assets/` |
| QA-008 | `migrations/007-fix-admin-questions-view.sql` added — **you must run it in the Supabase SQL editor**; the view is broken on the live project until then. | `migrations/` |

Not yet addressed: the older open items (QA-001…QA-005, QA-007, QA-009…QA-027) listed at the end.

## Live authenticated verification (2026-07-20, admin session)

The publish flow was exercised end-to-end against the live Supabase project using a throwaway class (0 members) and a throwaway 3-question test, both deleted afterward. Real students/tests were never touched.

**PLAT-1 (new Critical discovery, now fixed):** the live `questions` table has a *column-limited* SELECT grant (answer fields withheld — that's the answer-leak protection working as designed), and that grant **rejects any write that echoes rows back**: `Prefer: return=representation` fails (`RETURNING *` needs SELECT on every column) and `INSERT … ON CONFLICT` (upsert) fails the same way. `window.satInsert`/`satPatch` default to `return=representation`, so **the builder's DB publish has been broken on the live project all along** — in the previously committed code *and* in the uncommitted rework. The two existing 98-question tests must have been seeded via SQL. Live probes: INSERT `return=representation` → `permission denied for table questions`; INSERT `return=minimal` → OK; PATCH `return=minimal` → OK; upsert (either return mode) → denied.

**Fix applied:** `publishTest` now generates question row ids client-side (`crypto.randomUUID()`), inserts with `return=minimal`, and updates kept rows with per-row PATCHes in parallel batches of 10 (`patchQuestions`) instead of upsert. Client-generated ids also make retries idempotent (a re-run matches previously inserted rows by id instead of duplicating them).

**Verified live:**
- Publish of a new 3-question test (2 MCQ + 1 SPR, class-scoped): status `published`, `order_num` 0/1/2, correct answers and `answer_type='spr'` persisted, exactly one class assignment. ✓
- Republish after editing Q1, deleting Q2, adding Q4: **Q1 and Q3 kept their row ids** (attempt history would survive — NEW-1 confirmed fixed), only Q2's row was deleted, Q4 inserted, `order_num` renumbered 0/1/2 with no negative leftovers (NEW-4 confirmed fixed), class assignment intact (NEW-2 path), status `published`. ✓
- **QA-008 corruption demonstrated live:** with the stale view, `loadDraft` received the SPR question with no `answer_type`/`answer_text` keys, so the builder showed it as an MCQ with empty choices. Do not edit SPR tests until migration 007 is run. ✗
- Admin page sweep with data: dashboard, tests, students, classes, vocabulary, leaderboard all render without console errors; Question Bank fails with "Could not load question bank" (QA-008, needs migration 007). ✗ (that one page)

---

## Verdict

The uncommitted changes are **mostly good** — real improvements that fix or soften several previously reported bugs. But the reworked test-builder publish flow has **one critical residual bug and two new bugs of its own** (NEW-2, NEW-3, NEW-4 below). Fix at least NEW-1/NEW-2 before committing, or commit with the publish flow reverted.

### What the uncommitted changes verifiably fix (safe to keep)

| Change | File | Status |
|---|---|---|
| Login pages show specific error messages (bad password vs. network vs. inactive profile) | `js/admin-login.js`, `js/student-login.js` | ✅ Browser-verified: invalid credentials show "Incorrect username or password…" |
| Practice "Check" now has a catch + user-visible failure alert (was silent, part of old QA-017) | `js/student-practice.js` | ✅ Code-verified |
| Reload can no longer extend a module deadline (restored deadline is clamped to `startedAt + duration`) — softens old QA-012 client side | `js/student-test-solve.js:251-254` | ✅ Code-verified |
| Restoring an already-expired module immediately shows "Time's up" instead of a live timer | `js/student-test-solve.js:292-297` | ✅ Code-verified |
| Elapsed time can no longer over-count past the deadline | `js/student-test-solve.js:273-285` | ✅ Code-verified |
| Keyboard shortcuts 1–4/a–d no longer select out-of-range choices | `js/student-test-solve.js:770` | ✅ Code-verified |
| `formatTime` no longer renders fractional seconds | `js/shared.js:53` | ✅ Code-verified |
| Publish failure *before* the deletion step no longer wipes an existing test's questions (softens old QA-006) | `js/admin-test-builder.js` | ✅ Partially — see NEW-1/NEW-2 |
| Builder wrapped in IIFE with explicit `window` exports | `js/admin-test-builder.js` | ✅ All 13 inline-handler functions are exported; none missing |
| Homepage redesign (hero chips, gradient headline) | `index.html`, `css/index.css` | ✅ Browser-verified desktop + 375px, no horizontal overflow, no console errors, reduced-motion respected, chips `aria-hidden` |
| `_headers` (no-cache revalidation, nosniff, referrer policy) | `_headers` | ✅ Correct for Cloudflare Pages |

---

## Summary of bugs

| ID | Title | Severity | Where | Status |
|---|---|---|---|---|
| NEW-1 | Republishing a test still permanently deletes all historical attempt answers | Critical | `js/admin-test-builder.js` | Confirmed (residual from QA-006) |
| NEW-2 | Failed republish deletes the test's assignments and never restores them | High | `js/admin-test-builder.js:213-235, 255-283` | Confirmed (new in this diff) |
| NEW-3 | During republish, students briefly see the test with double questions | Medium | `js/admin-test-builder.js:201-211` | Confirmed (new in this diff) |
| NEW-4 | Republished questions keep negative `order_num` forever | Medium | `js/admin-test-builder.js:188-199` | Confirmed (new in this diff) |
| NEW-5 | Failure after the delete step strands the test as a draft with staged questions | Medium | `js/admin-test-builder.js:277-278` | Confirmed (new in this diff) |
| NEW-6 | Login can leave a signed-in session stranded on the login page | Low | `js/admin-login.js`, `js/student-login.js` | Confirmed |
| NEW-7 | Hero background image is 1.7 MB | Low | `assets/home-hero.png` | Confirmed |
| QA-008 | Live `admin_questions` view is still missing SPR columns (re-probed today: still broken) | Critical | Supabase (deploy), `schema.sql:158` | Re-confirmed live |

Old-report items that remain open are listed at the end.

---

## NEW-1 — Republishing a test still permanently deletes all historical attempt answers (Critical)

**Description.** The new publish flow (insert staged replacements first, delete old questions last) protects question content against *failure*, but on **success** it still runs `DELETE FROM questions WHERE id IN (old ids)` (`js/admin-test-builder.js:237-240`). `attempt_answers.question_id` has `ON DELETE CASCADE` (`schema.sql:199`), so every submitted attempt's per-question review rows for this test are destroyed the moment an admin republishes — even a no-op republish that just fixes a typo in the test name. Students' past results pages lose all per-question detail.

**Reproduction.**
1. Have a student submit an attempt for a published test; open its results and confirm per-question rows.
2. As admin, open the test in the builder and click Publish (change nothing).
3. Re-open the student's results — the review is empty.

**How to fix.**
The clean fix is to stop deleting/recreating rows and instead *diff and update*:
1. In `publishTest()`, for an existing test, fetch existing question ids and match them to the in-memory questions (they already carry `id` from `loadDraft()` — DB questions keep their uuid, new ones have `q_<timestamp>` ids).
2. `PATCH` questions whose id is a uuid (update stem/choices/etc. in place — attempt history survives), `INSERT` only the truly new ones, and `DELETE` only questions the admin actually removed.
3. Longer term, move the whole publish into a single `SECURITY DEFINER` RPC (e.g. `publish_test(p_test_id, p_questions jsonb)`) so it is one transaction, and change `attempt_answers.question_id` to `ON DELETE SET NULL` (keeping a snapshot of stem/answer in the row, or an archived-questions table) so history can never be cascaded away.

A minimum stop-gap if you don't want the full diff logic yet: block republish when submitted attempts exist (`test_attempts?test_id=eq.X&status=eq.submitted&limit=1`) and show "This test has submitted attempts; duplicate it instead of editing."

---

## NEW-2 — Failed republish deletes the test's assignments and never restores them (High)

**Description.** The flow deletes **all** `test_assignments` for the test (`js/admin-test-builder.js:213`) *before* the last two steps (delete old questions, patch to published). The new rollback in the `catch` block restores the staged questions and the test status — but not the assignments. If the failure happens after the assignment delete but before/during the re-insert (network drop, RLS error, invalid class id), every class/student assignment and its due date is gone, while the toast says "Failed to publish. **Existing questions were preserved.**" — the admin has no idea students just lost access to the test.

**Reproduction.**
1. Edit a published, class-assigned test in the builder.
2. Kill the network right after the "Publishing test" spinner starts (or make the assignment insert fail).
3. If the failure lands between line 213 and 235: `test_assignments` for that test is now empty; the toast claims everything was preserved.

**How to fix.**
1. Before the try block (or at the top of it), snapshot the existing assignments: `const previousAssignments = await window.satRest('test_assignments?test_id=eq.…&select=test_id,class_id,student_id,assigned_by,due_at')`.
2. In the `catch` rollback branch (`wasExistingTest && !oldQuestionsDeleted`), re-insert the snapshot with `Prefer: resolution=ignore-duplicates` after restoring the status.
3. Better ordering: don't delete-then-recreate at all. Compute the delta (the class/all-students target changed or not) and only touch assignments when the target actually changed; use upsert (`resolution=merge-duplicates`) so due-date updates never require a delete.
4. The real fix is the same as NEW-1: one server-side RPC/transaction for the whole publish.

---

## NEW-3 — During republish, students briefly see the test with double questions (Medium)

**Description.** For an existing test the new order of operations is: **insert staged replacement questions → then set the test to `draft`** (`js/admin-test-builder.js:201-211`). Between those two requests the test is still `published`, so `student_questions` serves both the old rows and the staged new rows (~2× the questions, staged ones first because of their negative `order_num`). A student who opens or reloads the solver in that window loads a corrupted question set; module caps and grading assumptions break.

**Reproduction.** Timing-dependent: open the solver as a student at the same moment an admin republishes a large test (the insert of ~98 rows plus a round-trip gives a real window, larger on slow connections).

**How to fix.** Swap the order: patch the test to `draft` **first**, then insert the staged questions, delete the old ones, renumber (see NEW-4), and finally patch back to `published`. The draft window hides the test from `student_questions` for the whole operation. (Students mid-test already have questions loaded client-side and are unaffected.) Again, an RPC transaction removes the problem entirely.

---

## NEW-4 — Republished questions keep negative `order_num` forever (Medium)

**Description.** To avoid the `unique (test_id, module_key, order_num)` collision, staged rows are written with `order_num = lowestExistingOrder − rowCount + index` — i.e. negative values (`js/admin-test-builder.js:193-198`). After the old questions are deleted, **nothing renumbers the survivors back to 0…n**. The negative numbers are permanent, and every subsequent republish stacks further negative (−98 → −196 → …). Relative ordering happens to survive (the flat staging index preserves module order), but the data no longer matches the documented `order_num` semantics, any future code that assumes `order_num >= 0` or uses it as a display number breaks, and the drift is unbounded.

**Reproduction.**
1. Edit any published test and publish it unchanged.
2. `select order_num from questions where test_id = …` → all values negative.

**How to fix.** After the old-question delete succeeds and before the final publish patch, renumber in one pass:

```js
// after the satDelete of existingQuestionIds
await Promise.all(insertedQuestions.map((q, i) =>
  window.satPatch(`questions?id=eq.${encodeURIComponent(q.id)}`,
    { order_num: finalOrderFor(q) }, 'return=minimal')
));
```

where `finalOrderFor` restores the original `0…n` counter captured when `questionRows` was built (keep the pre-staging `order_num` on each row object so you can map it back). No collision is possible at that point because the old rows are gone. If you adopt the diff-and-update fix from NEW-1, this bug disappears with it.

---

## NEW-5 — Failure after the delete step strands the test as a draft with staged questions (Medium)

**Description.** If the flow fails after `oldQuestionsDeleted = true` (i.e. the final `status: 'published'` patch fails), the catch branch at `js/admin-test-builder.js:277-278` only shows a toast: "Replacement questions were saved, but the test remains a draft." The test is left unpublished (students lose it from their list), with negative-order questions (NEW-4) and possibly freshly rewritten assignments. There is no retry affordance; the admin must know to open the builder and publish again.

**How to fix.** In that branch, retry the final patch once before giving up, and if it still fails, keep the admin on the page with the Publish button re-enabled and a persistent (not auto-hiding) error banner saying exactly what to do ("Click Publish again to finish — your questions are saved"). The RPC-transaction fix (NEW-1) also eliminates this state.

---

## NEW-6 — Login can leave a signed-in session stranded on the login page (Low)

**Description.** In both login files, two paths now finish with the user authenticated but still on the login page: (a) the profile fetch fails with a *network* error — the code deliberately keeps the session and shows "You are signed in, but your profile could not be loaded"; (b) the outer `catch` (unexpected errors after successful `signInWithPassword`) no longer calls `signOut()` (the old code did). The stale session then makes subsequent behavior confusing: the guard on a protected page may silently let them through (or bounce them) depending on which request succeeds next.

**How to fix.** In `js/admin-login.js` and `js/student-login.js`: in the non-`SAT_PROFILE_ACCESS` profile-error branch and in the outer `catch`, either sign out before showing the error (simplest, restores old behavior), or keep the session but change the message to a real affordance: "You are signed in — retry loading your profile" with a retry button that calls `requireXProfile` again and redirects on success.

---

## NEW-7 — Hero background image is 1.7 MB (Low)

**Description.** `assets/home-hero.png` is 1,677,430 bytes and is loaded as the homepage hero background. With the new `_headers` `no-cache` policy, browsers revalidate every visit (cheap 304s), but first paint on mobile connections pays the full 1.7 MB.

**How to fix.** Re-encode to WebP/AVIF at the rendered size (a `background-image` at ~1600 px wide typically lands at 150–300 KB in WebP): `cwebp -q 78 assets/home-hero.png -o assets/home-hero.webp`, then update `css/index.css:61` (keep a PNG fallback via `image-set()` if you want older-browser support).

---

## QA-008 (re-confirmed live today) — deployed `admin_questions` view is still missing SPR columns (Critical for admin flows)

**Probe (2026-07-20, anon key, read-only):** `GET /rest/v1/admin_questions?select=answer_type&limit=1` → **400** `column admin_questions.answer_type does not exist`.

This matters *more* now: `loadDraft()` in the new builder reads `answer_type`/`answer_text` from `admin_questions?select=*` (`js/admin-test-builder.js:77,90-91`). On the live DB those columns silently come back undefined, so **editing any test that contains SPR questions loads them as MCQs with empty choices** — and republishing would either fail validation or overwrite the SPR questions as broken MCQs, compounding NEW-1's history loss. Admin Question Bank also still fails outright ("Could not load question bank").

**How to fix.** Run once in the Supabase SQL editor (and save it as `migrations/007-fix-admin-questions-view.sql` so new deploys get it):

```sql
create or replace view public.admin_questions as
select q.*
from public.questions q
where public.is_admin();
grant select on public.admin_questions to authenticated;
```

Because the live view was created before migration 001 added the columns, `create or replace` re-freezes the column list to the current `questions.*`. Verify with the same probe (expect 200/`[]`).

Also confirmed still healthy today (anonymous boundary): `questions?select=correct,answer_text,explanation` → **401**; `student_questions?select=correct` → **400** (column absent from the view). No anonymous answer leak.

---

## Still open from the 2026-07-13 report (unchanged by this diff)

These were not addressed by the uncommitted changes and remain as documented in `docs/qa-bug-report.md`:

- **Critical/suspected (need credentials to confirm):** QA-001 (Question Bank can expose assigned-test answer keys pre-submission), QA-002 (manufactured attempts can extract answer keys), QA-003 (`create-student` auto-assigns every published test).
- **Critical/confirmed:** QA-004 (placeholder linear SAT scoring), QA-005 (malformed SPR accepted answers grade correct), QA-007 (mismatched `testId`/`attemptId` submits the wrong test).
- **High:** QA-009 (break state not resumable — still true: `confirmEndModule` nulls the module timestamps before `startBreak`, so a reload during break restarts R&W Module 2 with a full clock), QA-010 (Question Bank doesn't render images), QA-011 (builder has no topic/explanation editor), QA-012 (server still trusts client `p_time_taken`; the new clamp only hardens the client).
- **Medium/Low:** QA-013 dark mode, QA-014 six-char SPR entry (`sanitizeSprValue`/`maxlength=6` unchanged), QA-015–QA-027 as previously documented.

---

## Coverage notes

- ✅ Browser-tested (served via `python3 -m http.server 5173`): homepage desktop + 375 px (no horizontal overflow, no console errors, chips/gradient render, reduced-motion honored), student login invalid-credential path (new specific error message shown), admin login shell, auth-guard redirects for `student-home`, `student-tests`, `admin-test-builder` while logged out.
- ✅ `node --check` passed on all JS files; all 13 builder inline handlers verified against the new IIFE exports.
- ✅ Live read-only Supabase probes: answer-field boundary still denied anonymously; `admin_questions` still stale (QA-008).
- ⚠️ Not testable without credentials (same limitation as the previous report): authenticated student/admin journeys, the publish flow end-to-end (NEW-1…NEW-5 are proven from the code + schema FKs and the deterministic request order, not executed against live data), concurrency, storage upload.

## Recommended order before committing

1. Fix **NEW-2** (assignment snapshot/restore) and **NEW-3** (draft-first ordering) — small, local edits to `publishTest()`.
2. Add the **NEW-4** renumber step (or adopt the diff-update approach, which also resolves NEW-1).
3. Deploy the **QA-008** view fix to Supabase (one SQL statement) — without it, editing SPR tests in the new builder corrupts them.
4. Decide on **NEW-1**: diff-and-update, RPC transaction, or the block-republish stop-gap.
5. Everything else in the diff is safe to commit as-is.
