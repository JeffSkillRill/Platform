# SAT Platform QA Bug Report

**QA date:** 2026-07-13  
**Scope:** read-and-test pass of the static Admin and Student portals, every HTML page, every `js/` module, `schema.sql`, migrations 001–006, and the deployed Supabase anonymous boundary.  
**Test origin:** `http://localhost:5173` using `python3 -m http.server 5173`.  
**Code changes:** none. The only QA harness was a throwaway server under `/tmp`; no application behavior was edited and no Supabase data was seeded or changed.

## Security release blockers

The anonymous boundary blocked raw answer-table access, but three authenticated-student paths remain release blockers pending credentialed confirmation:

- **QA-001:** the Question Bank can return the answer key for an assigned, not-yet-submitted graded test.
- **QA-002:** attempt RLS and the scoring RPC do not require assignment, so a student can manufacture and submit an attempt for another test, then review its answers.
- **QA-003:** creating a student assigns every published test, including class-scoped tests, to that student.

These are marked **Suspected**, not Confirmed, because no valid student/admin credentials were available. The SQL and client call chains are complete and reproducible, but the final authenticated requests were not executed.

Anonymous controls that did pass against the live project:

- `questions?select=correct,answer_text,explanation` → **401** `permission denied for table questions`.
- `student_questions?select=correct,answer_text,explanation` → **400** because those columns are absent from the view.
- `admin_questions?select=correct,explanation` → **200** with `[]` for the anonymous role.
- `test_attempts` anonymous insert → **401** RLS violation.
- anonymous `create-student` call → **401** missing authorization header.
- anonymous `get_attempt_review(random_uuid)` → **400** `Review not available`.

## Credentials and access limitation

The live Supabase project is reachable, but there was no existing browser session and no valid admin or student login was provided. Therefore valid login/logout, session refresh/expiry, authenticated RLS, destructive admin workflows, Storage upload, submitted-result rendering, concurrency, and live offline recovery could not be executed.

To finish those checks safely, QA needs:

1. One active admin username/password and one active student username/password.
2. Confirmation that QA may create and later deactivate/delete throwaway students, classes, tests, attempts, vocabulary, and Storage objects in this project, or a disposable Supabase project/ref.
3. Ideally, two students in different classes and one class-only published test, so cross-class assignment/RLS can be proved without touching real exam data.

## Summary

| ID | Title | Severity | Area | Status |
|---|---|---|---|---|
| [QA-001](#qa-001--question-bank-reveals-assigned-test-answers-before-test-submission) | Question Bank reveals assigned-test answers before test submission | Critical | Auth | Suspected |
| [QA-002](#qa-002--student-can-manufacture-an-unassigned-attempt-and-extract-its-answer-key) | Student can manufacture an unassigned attempt and extract its answer key | Critical | Auth | Suspected |
| [QA-003](#qa-003--create-student-auto-assigns-class-scoped-tests-to-every-new-student) | `create-student` auto-assigns class-scoped tests to every new student | Critical | Auth | Suspected |
| [QA-004](#qa-004--rpc-uses-placeholder-linear-scoring-as-an-sat-score) | RPC uses placeholder linear scoring as an SAT score | Critical | Test-flow | Confirmed |
| [QA-005](#qa-005--malformed-spr-values-can-be-configured-and-graded-correct) | Malformed SPR values can be configured and graded correct | Critical | Test-flow | Confirmed |
| [QA-006](#qa-006--republishing-a-test-deletes-historical-attempt-answers) | Republishing a test deletes historical attempt answers | Critical | Data | Confirmed |
| [QA-007](#qa-007--mismatched-testid-and-attemptid-submit-and-score-the-wrong-test) | Mismatched `testId` and `attemptId` submit and score the wrong test | Critical | Test-flow | Suspected |
| [QA-008](#qa-008--live-admin_questions-view-is-missing-spr-columns) | Live `admin_questions` view is missing SPR columns | High | Admin | Confirmed |
| [QA-009](#qa-009--break-state-is-not-resumable-and-its-clock-pauses-in-the-background) | Break state is not resumable and its clock pauses in the background | High | Test-flow | Confirmed |
| [QA-010](#qa-010--question-bank-does-not-render-question-images) | Question Bank does not render question images | High | Test-flow | Confirmed |
| [QA-011](#qa-011--test-builder-has-no-topic-or-explanation-editor) | Test builder has no topic or explanation editor | High | Admin | Confirmed |
| [QA-012](#qa-012--graded-test-time-limits-are-enforced-only-in-the-client) | Graded-test time limits are enforced only in the client | High | Test-flow | Suspected |
| [QA-013](#qa-013--dark-mode-is-unavailable-on-every-page) | Dark mode is unavailable on every page | Medium | UI | Confirmed |
| [QA-014](#qa-014--spr-entry-allows-six-characters-and-invalid-number-syntax) | SPR entry allows six characters and invalid number syntax | Medium | Test-flow | Confirmed |
| [QA-015](#qa-015--question-bank-check-feedback-omits-the-correct-answer) | Question Bank Check feedback omits the correct answer | Medium | Test-flow | Confirmed |
| [QA-016](#qa-016--exiting-question-bank-leaves-an-active-session-orphaned) | Exiting Question Bank leaves an active session orphaned | Medium | Data | Confirmed |
| [QA-017](#qa-017--multiple-networked-actions-have-no-failure-state) | Multiple networked actions have no failure state | Medium | UI | Confirmed |
| [QA-018](#qa-018--vocabulary-progress-is-race-prone-and-streaks-never-accumulate) | Vocabulary progress is race-prone and streaks never accumulate | Medium | Data | Confirmed |
| [QA-019](#qa-019--new-test-assign-to-selection-is-ignored) | New-test “Assign to” selection is ignored | Medium | Admin | Confirmed |
| [QA-020](#qa-020--major-pages-perform-unbounded-reads-and-select) | Major pages perform unbounded reads and `select=*` | Medium | Perf | Confirmed |
| [QA-021](#qa-021--class-member-count-view-can-bypass-student-row-visibility) | Class-member-count view can bypass student row visibility | Medium | Auth | Suspected |
| [QA-022](#qa-022--core-controls-are-not-keyboard-operable-and-images-lack-useful-alt-text) | Core controls are not keyboard operable and images lack useful alt text | Medium | UI | Confirmed |
| [QA-023](#qa-023--temporary-student-passwords-are-visible-plain-text-fields) | Temporary student passwords are visible plain-text fields | Medium | Admin | Confirmed |
| [QA-024](#qa-024--readme-setup-instructions-omit-four-required-migrations-and-current-pages) | README setup omits four required migrations and current pages | Medium | Data | Confirmed |
| [QA-025](#qa-025--admin-settings-link-is-a-dead-anchor) | Admin Settings link is a dead anchor | Low | UI | Confirmed |
| [QA-026](#qa-026--every-browser-visit-requests-a-missing-favicon) | Every browser visit requests a missing favicon | Low | UI | Confirmed |
| [QA-027](#qa-027--admin-activity-feed-is-not-chronological) | Admin activity feed is not chronological | Low | Admin | Confirmed |

---

## QA-001 — Question Bank reveals assigned-test answers before test submission

**Description.** Question Bank draws directly from every `student_questions` row available to the student, including questions in assigned graded tests that the student has not submitted. `practice_sessions` accepts arbitrary question IDs owned by the student session, and `check_practice_answer()` returns `correct`, `answer_text`, and `explanation` after a practice guess without checking for a submitted test attempt.

**Reproduction.** Requires a student credential.

1. Assign a published Test A to the student, but do not start or submit it.
2. Open Question Bank and start a session containing a Test A question; alternatively insert an own `practice_sessions` row whose `question_ids` includes that question ID.
3. Submit any answer to `rpc/check_practice_answer` with that session/question.
4. Inspect the response.

**Expected.** Questions belonging to an unsubmitted graded test are not practice-eligible, or the RPC withholds the key until the graded attempt is submitted.  
**Actual.** The RPC returns the correct choice/accepted SPR answer and explanation before the graded attempt is committed.

**Affected code.** `js/student-question-bank.js:85-100,173-177`; `migrations/005-question-bank.sql:84-96,107-139,184`.  
**Console/network evidence.** Static call chain confirmed. Authenticated request not executed because no student credential was available. The exact proof request is `POST /rest/v1/rpc/check_practice_answer` for a session containing an unsubmitted Test A question.  
**Suggested fix direction.** Separate practice-safe questions from live test questions, or require an eligible submitted attempt before returning answer fields.

## QA-002 — Student can manufacture an unassigned attempt and extract its answer key

**Description.** Attempt insert RLS checks only ownership and `in_progress` status. It does not require the test to be published or assigned. `submit_attempt()` similarly validates only attempt ownership/status, then reads every question using its `SECURITY DEFINER` privileges. After the manufactured attempt is submitted, `get_attempt_review()` returns the full answer key. The globally readable `leaderboard_attempts` view exposes test IDs needed for the attack.

**Reproduction.** Requires a student credential and a test assigned to another student/class.

1. As Student A, query `leaderboard_attempts?select=test_id` and choose a Test B ID not assigned to A.
2. Insert `{student_id: A, test_id: B, status: "in_progress"}` into `test_attempts`.
3. Call `submit_attempt` for that attempt with `{}`.
4. Call `get_attempt_review` for the newly submitted attempt.

**Expected.** Both attempt creation and submission reject tests that are not currently published and assigned to the caller.  
**Actual.** The policies/functions contain no assignment check; review then returns `correct`, `answer_text`, and `explanation` for Test B.

**Affected code.** `schema.sql:206-221,439-448,483,489`; `migrations/001-spr-and-question-times.sql:165-183,269-327`.  
**Console/network evidence.** Anonymous attempt insertion correctly returned **401** RLS, but authenticated-student reproduction was blocked by missing credentials.  
**Suggested fix direction.** Enforce published assignment/class membership inside attempt insert policy and again inside `submit_attempt()`.

## QA-003 — `create-student` auto-assigns class-scoped tests to every new student

**Description.** The Edge Function defaults `assign_existing_tests` to true, selects every published test without considering class assignments, and inserts direct student assignments for all of them. Both Admin UIs omit the flag, so the unsafe default always applies.

**Reproduction.** Requires an admin credential.

1. Publish a test assigned only to Class A.
2. Create a new student intended for Class B using either Admin “Create student” form.
3. Query `test_assignments` for the new student or log in as that student.
4. Observe a direct assignment to the Class A test.

**Expected.** A new student receives no tests until explicitly added to a class/assignment, or only truly global tests.  
**Actual.** Every published test is directly assigned, bypassing class scope and exposing its questions.

**Affected code.** `supabase/functions/create-student/index.ts:55-60,114-144`; `js/admin-students.js:104-116`; `js/admin-dashboard.js:198-210`.  
**Console/network evidence.** Anonymous function call returned **401**, confirming the outer auth gate. The authorized mutation was not run without admin credentials.  
**Suggested fix direction.** Default to no automatic assignment and model explicit global tests separately from class-scoped tests.

## QA-004 — RPC uses placeholder linear scoring as an SAT score

**Description.** `submit_attempt()` calculates each section as `200 + round(percent_correct * 600)`. The schema itself labels this a placeholder. It has no test-specific conversion table or adaptive-module scale, yet the UI presents the result as a 400–1600 SAT score.

**Reproduction.** Deterministic from the deployed function definition.

1. Submit a 54-question R&W section with 27 correct.
2. The RPC computes `200 + round((27/54) * 600) = 500`.
3. Repeat with any raw score; the result is a straight line from 200 to 800.

**Expected.** A validated test-specific SAT conversion is used, or the result is clearly labelled a raw/estimated practice score.  
**Actual.** A known placeholder is stored and displayed as the authoritative SAT scaled score.

**Affected code.** `schema.sql:233-235,305-325`; `migrations/001-spr-and-question-times.sql:241-263`.  
**Console/network evidence.** No valid student attempt was available; the exact deterministic formula is in the active RPC migration.  
**Suggested fix direction.** Store versioned conversion tables per test/form and make the RPC use them before displaying an SAT score.

## QA-005 — Malformed SPR values can be configured and graded correct

**Description.** Builder validation requires only a non-empty accepted-answer string. The grading helper performs exact string equality before numeric validation, so invalid values such as `1/0` and `1..2` grade correct when repeated exactly. A comma-only answer list also publishes but can never be correct.

**Reproduction.** Live pure-RPC proof:

1. Call `sat_spr_is_correct("1/0", "1/0")`.
2. Call `sat_spr_is_correct("1..2", "1..2")`.
3. Both return `true`.

**Expected.** Accepted answers and student responses must parse as valid SAT SPR numeric forms; divide-by-zero and multiple-decimal strings are rejected.  
**Actual.** Live RPC returned **200 `true`** for both malformed cases. Valid equivalence checks `.75` vs `3/4` and whitespace-trimmed `0.75` vs `3/4` also returned true as expected.

**Affected code.** `admin-test-builder.html:277-289`; `js/admin-test-builder.js:133-140,177-183`; `migrations/001-spr-and-question-times.sql:39-71,83-108`.  
**Console/network evidence.** `POST /rest/v1/rpc/sat_spr_is_correct` → **200 `true`** for `1/0` and `1..2`.  
**Suggested fix direction.** Validate every accepted token numerically before publish and remove exact-match success for tokens that do not parse.

## QA-006 — Republishing a test deletes historical attempt answers

**Description.** Editing/publishing first sets the test to draft and deletes all its questions. `attempt_answers.question_id` has `ON DELETE CASCADE`, so this permanently removes every historical per-question result. New questions get new IDs and are not connected to old attempts. The multi-request workflow is also non-transactional; failure after deletion leaves a draft/partial test and may delete assignments.

**Reproduction.** Requires admin/student data, but the destructive chain is deterministic.

1. Submit a test and confirm its review contains question rows.
2. Open the same test in the builder and publish it again, even without intentional content changes.
3. Reopen the old submitted result.
4. The attempt remains, but its `attempt_answers` rows/review are gone.

**Expected.** Republishing preserves historical attempt snapshots and either updates questions safely or creates a new test version atomically.  
**Actual.** Question deletion cascades into historical reviews; intermediate failure can also leave the test draft/empty despite the toast claiming it “stayed” in its prior state.

**Affected code.** `js/admin-test-builder.js:146-155,165-225`; `schema.sql:196-203`.  
**Console/network evidence.** Not run against production because it is destructive and no mutation approval/credentials were available. SQL FK and request order directly reproduce the loss.  
**Suggested fix direction.** Version tests/questions and publish through one transaction; never cascade-delete answer history.

## QA-007 — Mismatched `testId` and `attemptId` submit and score the wrong test

**Description.** The solver trusts two independent URL parameters. It loads the test/questions selected by `testId` but never verifies that the own `attemptId` belongs to that test. On submit, the RPC grades the test stored on the attempt, not the questions shown in the browser.

**Reproduction.** Requires one student assigned to two tests.

1. Start Test A and keep its `attemptId`.
2. Replace only `testId=A` with `testId=B` in the solver URL.
3. Answer Test B and submit.
4. The RPC loops Test A's question IDs; the submitted B IDs do not match, so Test A is submitted/scored as unanswered or incorrectly answered.

**Expected.** The solver loads the attempt first and derives/validates its test ID; mismatches are rejected without submission.  
**Actual.** Client code never fetches the attempt before rendering/submitting.

**Affected code.** `js/student-test-solve.js:9-11,35,128-176,617-638`; `migrations/001-spr-and-question-times.sql:165-183`.  
**Console/network evidence.** Credentialed end-to-end proof was unavailable; the client and RPC use different sources of truth exactly as described.  
**Suggested fix direction.** Accept only `attemptId`, fetch its assigned test server-side, and verify the relationship before rendering and submitting.

## QA-008 — Live `admin_questions` view is missing SPR columns

**Description.** `admin_questions` is created with `select q.*` before migration 001 adds `answer_type` and `answer_text`. PostgreSQL freezes the view column list at creation; migration 001 recreates `student_questions` but not `admin_questions`.

**Reproduction.** Live and read-only.

1. Request `admin_questions?select=answer_type` with the anon key.
2. Request `admin_questions?select=answer_text`.
3. Open Admin Question Bank as an admin; its first query selects `answer_type`.

**Expected.** The view exposes all current question columns to admins.  
**Actual.** Both live probes return **400 / 42703**: `column admin_questions.answer_type does not exist` and `column admin_questions.answer_text does not exist`. Admin Question Bank therefore falls into “Could not load question bank.” Existing SPR questions also load into the builder without their SPR type/accepted answers.

**Affected code.** `schema.sql:113-162`; `migrations/001-spr-and-question-times.sql:5-7,116-134`; `js/admin-question-bank.js:1-24`; `js/admin-test-builder.js:76-93`.  
**Console/network evidence.** Live REST **400** for both missing columns.  
**Suggested fix direction.** Recreate `admin_questions` after all question-column migrations, preferably with an explicit column list and an idempotent verification check.

## QA-009 — Break state is not resumable and its clock pauses in the background

**Description.** At the R&W-to-Math transition the solver clears the module timestamps and saves while `currentMod` still points at R&W Module 2. Break state/deadline is never persisted. Reload therefore starts R&W Module 2 again with a full duration. The break itself decrements a counter with `setInterval`, so browser throttling/background suspension extends it. The title is also hardcoded to “10-Minute Break” even when `break_minutes` differs.

**Reproduction.** Static control-flow proof; live student data required for UI execution.

1. Finish R&W Module 2 and enter the break.
2. Reload during the break.
3. Observe R&W Module 2 restart with a new full deadline.
4. Separately, background the tab during break; elapsed wall time is not deducted reliably.

**Expected.** The break phase and an absolute break deadline survive reload/backgrounding, then resume or advance consistently.  
**Actual.** Only module state is saved; the break is a non-persistent decrementing interval.

**Affected code.** `js/student-test-solve.js:137-155,186-200,241-277,386-437`; `student-test-solve.html:74-94`.  
**Console/network evidence.** No network request is involved; defect is deterministic client state handling.  
**Suggested fix direction.** Persist an explicit phase and absolute break deadline, derive remaining time from `Date.now()`, and render the configured duration.

## QA-010 — Question Bank does not render question images

**Description.** Question Bank fetches `image_url` but `renderQuestion()` renders only stem and answer controls. Any graph, table, or figure supplied only as an image is missing, making the question unanswerable.

**Reproduction.** Requires an assigned image-based question.

1. Add an image-dependent question to a published assigned test.
2. Start a Question Bank session that includes it.
3. Observe that no image appears.

**Expected.** The safe image URL is rendered with useful alt text.  
**Actual.** `image_url` is loaded and discarded.

**Affected code.** `js/student-question-bank.js:107-122,173-177`.  
**Console/network evidence.** No image request can occur because no `<img>` is generated.  
**Suggested fix direction.** Render `safeImageUrl(q.image_url)` in the session card with authored/descriptive fallback alt text.

## QA-011 — Test builder has no topic or explanation editor

**Description.** The builder UI exposes module, difficulty, answer type, stem, image, and answers, but no topic or explanation fields. `collectCurrentForm()` cannot collect them. New questions therefore publish `null`, and existing values cannot be edited even though the result/practice screens depend on them.

**Reproduction.** Static page reproduction.

1. Open a new question in Admin Test Builder.
2. Attempt to set topic and explanation as required by the admin journey.
3. No controls exist.

**Expected.** Admin can create/edit topic and explanation for both MCQ and SPR.  
**Actual.** No such fields exist; only already-loaded in-memory values can be republished unchanged.

**Affected code.** `admin-test-builder.html:195-290`; `js/admin-test-builder.js:417-428`.  
**Console/network evidence.** Published payload explicitly falls back to `q.topic || null` and `q.explanation || null` at `js/admin-test-builder.js:181-182`.  
**Suggested fix direction.** Add validated topic/explanation inputs and include them in load/collect/save/publish flows.

## QA-012 — Graded-test time limits are enforced only in the client

**Description.** Module deadlines and elapsed time live only in browser state/localStorage. `submit_attempt()` accepts arbitrary client-provided `p_time_taken` and does not compare server `started_at`, test durations, or module deadlines. A student can extend the local deadline, pause JavaScript, or call the RPC with a false time.

**Reproduction.** Requires a student credential.

1. Start an attempt and wait or pause the page.
2. Extend the saved `moduleDeadlineAt`/client clock state or directly call `submit_attempt` with `p_time_taken: 0`.
3. Submit after the allotted wall time.

**Expected.** Server rejects or flags attempts that exceed configured timing and records authoritative elapsed time.  
**Actual.** The server clamps only negative time to zero and trusts the rest of the client submission.

**Affected code.** `js/student-test-solve.js:128-155,241-323,617-635`; `migrations/001-spr-and-question-times.sql:249-263`.  
**Console/network evidence.** Authenticated tamper proof was blocked by missing credentials; no server-side timing check exists in the function.  
**Suggested fix direction.** Persist server-side module phase/deadlines and compute/validate elapsed time inside the submission RPC.

## QA-013 — Dark mode is unavailable on every page

**Description.** `js/theme.js` exists, but no HTML page includes it. No stylesheet defines a `[data-theme="dark"]` (or equivalent) palette. The documented sidebar toggle is therefore never injected and changing the root data attribute would not restyle the app.

**Reproduction.** Confirmed on all 21 pages and by source search.

1. Open any page.
2. Look for the documented Dark mode toggle.
3. Repeat on Admin and Student pages.

**Expected.** Every page can toggle a persistent, contrast-safe dark theme.  
**Actual.** No toggle is present and there are no dark-theme styles.

**Affected code.** `js/theme.js:1-35`; every HTML file; all CSS files.  
**Console/network evidence.** No request for `/js/theme.js` occurred on any served page.  
**Suggested fix direction.** Load the theme module consistently and define complete token overrides with contrast testing.

## QA-014 — SPR entry allows six characters and invalid number syntax

**Description.** The requested SAT grid-in limit is five characters, but solver, mistakes practice, and Question Bank all use `maxlength=6`/`slice(0,6)` and render six slots. Sanitization only filters characters; it still allows `1..2`, `1//2`, `--`, and similar malformed forms.

**Reproduction.** Static and scorer-backed.

1. Open an SPR question.
2. Type six allowed characters, or `1..2`.
3. The UI accepts the value and treats it as answered.

**Expected.** At most five characters and one syntactically valid SAT integer/decimal/fraction form.  
**Actual.** Six characters and malformed punctuation are accepted. Live scorer also graded exact malformed configured values as correct; see QA-005.

**Affected code.** `js/student-test-solve.js:458-489,586-596`; `js/student-practice.js:48-60`; `js/student-question-bank.js:115-124`.  
**Console/network evidence.** Client accepts these without a validation request or error.  
**Suggested fix direction.** Use one shared five-character SPR parser/validator on every client and revalidate server-side.

## QA-015 — Question Bank Check feedback omits the correct answer

**Description.** `check_practice_answer()` returns the correct MCQ index or accepted SPR answer, but Question Bank renders only “Correct/Not quite” and optional explanation. A wrong answer can therefore provide no correction at all when explanation is blank.

**Reproduction.** Requires a student session.

1. Answer a Question Bank item incorrectly.
2. Click Check.
3. Inspect the feedback and network response.

**Expected.** After Check commits the practice answer, feedback identifies the correct choice/accepted answer.  
**Actual.** Response contains the key, but UI omits it.

**Affected code.** `migrations/005-question-bank.sql:91-96,184`; `js/student-question-bank.js:107-122,130-145`.  
**Console/network evidence.** Static response/UI mapping confirmed; authenticated request not executed.  
**Suggested fix direction.** Render `feedback.correct`/`feedback.answer_text` only after successful Check, matching mistakes practice.

## QA-016 — Exiting Question Bank leaves an active session orphaned

**Description.** Exit calls `renderSetup()` only. It neither marks the current `practice_sessions` row finished nor resumes/cleans it later, so every early exit leaves a permanent `active` session.

**Reproduction.** Requires a student credential.

1. Start a 10-question Question Bank session.
2. Answer fewer than all questions.
3. Click Exit.
4. Query the session row; status remains `active` with no `finished_at`.

**Expected.** Exit abandons/finishes the row explicitly or offers resume.  
**Actual.** The UI discards local session state while the database row remains active.

**Affected code.** `js/student-question-bank.js:85-100,119-127`; `migrations/005-question-bank.sql:5-15,168-182`.  
**Console/network evidence.** No PATCH/RPC is issued on Exit.  
**Suggested fix direction.** Add an explicit abandon/finish RPC or persistent resume flow.

## QA-017 — Multiple networked actions have no failure state

**Description.** Several async click/form handlers await Supabase and have no `try/catch`, disabled state, or user-visible failure. A dropped connection produces an unhandled rejection while the screen stays stale, making it unclear whether data was saved.

**Reproduction.** Can be performed once authenticated.

1. Go offline immediately before Question Bank Start/Check, mistakes Practice Check, vocabulary Good/Again/quiz/save, or Admin class/vocabulary CRUD.
2. Trigger the action.
3. Observe an unhandled console rejection and no reliable retry/error state.

**Expected.** Mutations fail loudly with controls re-enabled and a safe retry path.  
**Actual.** Many handlers reject out of the event callback with no UI recovery.

**Affected code.** `js/student-practice.js:155-173`; `js/student-question-bank.js:85-100,130-170`; `js/student-vocabulary.js:115-129,149-159,172-185`; `js/admin-classes.js:107-155`; `js/admin-vocabulary.js:152-200`.  
**Console/network evidence.** Static handler audit confirmed absent error branches; live network-drop run was credential-blocked.  
**Suggested fix direction.** Centralize mutation state/error handling and make every action idempotent/retryable.

## QA-018 — Vocabulary progress is race-prone and streaks never accumulate

**Description.** Quiz answer buttons remain enabled during the awaited save. Two rapid clicks can increment score/index twice and skip an item. Separately, `correct_streak` is overwritten with `1` or `0` on every review rather than incrementing the existing value, so it can never exceed one.

**Reproduction.** Requires vocabulary data.

1. Start a vocabulary quiz and double-click the correct answer before the network call completes; score and index can advance twice.
2. Mark the same word Good/correct on multiple reviews and inspect `vocab_progress.correct_streak`; it remains `1`.

**Expected.** One click produces one result; consecutive correct reviews accumulate a streak.  
**Actual.** Parallel handlers can skip questions, and every correct save writes literal `1`.

**Affected code.** `js/student-vocabulary.js:111-129,139-160`; `migrations/006-vocabulary.sql:26-33`.  
**Console/network evidence.** Event handler mutates score before its first `await` and has no lock; REST payload contains literal streak values.  
**Suggested fix direction.** Lock the question on first answer and update streak atomically in an RPC/upsert expression.

## QA-019 — New-test “Assign to” selection is ignored

**Description.** Admin Dashboard offers “All students” and “Select students,” but `createTest()` never reads `newTestAssign`, never shows a student selector, and does not carry the selection into the builder.

**Reproduction.** Static page reproduction.

1. Open Admin Dashboard → Create new test.
2. Choose “Select students.”
3. Click Create & build questions.
4. No student selection appears and the same draft is created as “All students.”

**Expected.** The selection changes assignment configuration or the misleading control is absent.  
**Actual.** It has no behavioral effect.

**Affected code.** `admin-dashboard.html:255-281`; `js/admin-dashboard.js:238-255`.  
**Console/network evidence.** The insert payload contains only name/status/creator.  
**Suggested fix direction.** Implement student selection and persist it into publish, or remove the control in favor of the class assignment flow.

## QA-020 — Major pages perform unbounded reads and `select=*`

**Description.** Leaderboards, dashboards, Admin classes/tests/vocabulary, and Student vocabulary fetch entire tables/views with no range/limit. Question Bank fetches every available question. This violates the documented scalability invariant and will increase latency/memory while exposing unnecessary columns.

**Reproduction.** Source/network reproduction.

1. Open the named pages with a populated database.
2. Inspect requests for `leaderboard_attempts?select=*`, `vocab_words?select=*`, `class_members?select=*`, and similar calls.
3. Observe no `limit`, range header, or pagination.

**Expected.** Bounded explicit-column reads; leaderboards capped to top 100 plus current user.  
**Actual.** Whole datasets and `*` columns are requested.

**Affected code.** `js/admin-dashboard.js:271-272`; `js/admin-leaderboard.js:51-52`; `js/admin-classes.js:157-164`; `js/admin-tests.js:10-15`; `js/admin-vocabulary.js:203-208`; `js/student-home.js:306-316`; `js/student-leaderboard.js:80-81`; `js/student-vocabulary.js:189-190`; `js/student-question-bank.js:173-177`.  
**Console/network evidence.** Static URL inventory confirmed. Logged-out pages redirect before these authenticated calls, so populated timing was unavailable.  
**Suggested fix direction.** Add explicit columns, server ordering, pagination/ranges, and top-N RPCs.

## QA-021 — Class-member-count view can bypass student row visibility

**Description.** `class_member_counts` is a normal owner-executed view, is granted to all authenticated users, and has no `is_admin()` filter or `security_invoker=true`. A student can therefore potentially read IDs/member counts for every class even though base-table RLS limits them to their own memberships.

**Reproduction.** Requires a student credential.

1. As a student in only Class A, request `class_member_counts?select=*`.
2. Compare returned class IDs with the student's `get_my_classes()` result.

**Expected.** Students see only their own classes, or the view is admin-only.  
**Actual.** Static view/grant configuration permits owner-level aggregation across all classes; live student result is pending.

**Affected code.** `migrations/004-classes.sql:121-128,169-172`.  
**Console/network evidence.** Credentialed query unavailable.  
**Suggested fix direction.** Make the view `security_invoker`, add caller filtering, or grant it only to an admin-only RPC.

## QA-022 — Core controls are not keyboard operable and images lack useful alt text

**Description.** Solver MCQ choices and question-number dots, result accordions, and builder choice letters/question chips are click-only `<div>` elements without roles, tab stops, or keyboard handlers. Solver question images use `alt=""`; practice/results use only generic “Question image.” Mobile navigation never updates `aria-expanded` and does not move/return/trap focus.

**Reproduction.** Static keyboard/accessibility reproduction.

1. Tab through a rendered test and try Enter/Space on an MCQ choice or question number.
2. Tab through submitted result cards and try to expand one.
3. Inspect dynamic question image alt text and the hamburger accessibility state.

**Expected.** All actions are native buttons/links or implement complete keyboard semantics; content images have meaningful authored alt text; drawer state/focus is announced.  
**Actual.** These controls cannot be reached/activated through standard Tab/Enter/Space, and image/drawer semantics are incomplete.

**Affected code.** `js/student-test-solve.js:440-505,517-519`; `js/student-test-results.js:178-199`; `js/admin-test-builder.js:381-390,524-536`; `js/mobile-nav.js:11-59`.  
**Console/network evidence.** DOM/source inspection; no network event.  
**Suggested fix direction.** Use native buttons, preserve visible focus, add authored alt text, and implement full accessible-dialog/drawer behavior.

## QA-023 — Temporary student passwords are visible plain-text fields

**Description.** Both Admin create-student forms use `type="text"` for passwords. Anyone nearby or in a screen recording sees credentials while they are typed, without opting into a Show action.

**Reproduction.** Static page reproduction.

1. Open either Admin Create Student form.
2. Type a temporary password.
3. Characters remain visible.

**Expected.** Passwords are masked by default with an explicit Show/Hide control and appropriate autocomplete metadata.  
**Actual.** Inputs are plain text.

**Affected code.** `admin-students.html:146`; `admin-dashboard.html:243-246`.  
**Console/network evidence.** DOM input type is `text`; no request required.  
**Suggested fix direction.** Use `type="password"`, `autocomplete="new-password"`, and an accessible reveal toggle.

## QA-024 — README setup instructions omit four required migrations and current pages

**Description.** README tells deployers to run only migrations 001–002 and lists the old page map. Classes, dashboard fields, Question Bank, and Vocabulary depend on migrations 003–006. Following README on a new project produces multiple broken pages.

**Reproduction.** Static documentation reproduction.

1. Follow README Supabase Setup exactly.
2. Only migrations 001 and 002 are applied.
3. Open classes, Question Bank, and Vocabulary pages.
4. Their tables/RPCs are missing.

**Expected.** Setup/run order and page map match the repository.  
**Actual.** README stops at migration 002 and omits current Admin/Student pages; `CODEX-NEXT-STEPS.md` also explicitly labels it stale.

**Affected code.** `README.md:7-13,48-58`; `CODEX-NEXT-STEPS.md:9-12`.  
**Console/network evidence.** Not a runtime request; new deployments would return missing relation/function errors.  
**Suggested fix direction.** Document migrations 001–006, seeds, all pages, theme/Edge Function, and add a read-only migration verifier.

## QA-025 — Admin Settings link is a dead anchor

**Description.** Admin Dashboard shows a Settings navigation item whose target is `#` and has no handler.

**Reproduction.** Open Admin Dashboard and click Settings.  
**Expected.** Navigate to settings or do not display the item.  
**Actual.** URL hash changes/stays on the same page with no content.  
**Affected code.** `admin-dashboard.html:69-74`.  
**Console/network evidence.** Static link checker found this as the only `href="#"`; all file-backed internal links resolved.  
**Suggested fix direction.** Implement the settings destination or remove/disable the link with honest labeling.

## QA-026 — Every browser visit requests a missing favicon

**Description.** No favicon link/file exists, so the browser requests `/favicon.ico` and receives 404.

**Reproduction.** Load `http://localhost:5173/` and inspect the server/network log.  
**Expected.** All routine local assets return 200.  
**Actual.** `GET /favicon.ico` → **404 File not found**.  
**Affected code.** Every HTML `<head>`; missing `favicon.ico`.  
**Console/network evidence.** Python server log recorded the 404; all referenced local HTML/CSS/JS/image assets otherwise resolved.  
**Suggested fix direction.** Add and reference a favicon.

## QA-027 — Admin activity feed is not chronological

**Description.** Activity is assembled as attempts first, then students, then tests, and sliced to six without timestamps or a final sort. A new student/test can appear below much older attempts or be omitted.

**Reproduction.** With populated data, create a student or test after several older attempts, then open Admin Dashboard.  
**Expected.** The six newest events across all event types are ordered newest first.  
**Actual.** Category concatenation determines order.  
**Affected code.** `js/admin-dashboard.js:154-175`.  
**Console/network evidence.** Deterministic render ordering; no final timestamp sort exists.  
**Suggested fix direction.** Attach machine timestamps, combine all events, sort descending, then slice.

---

## Coverage checklist

Legend: ✅ tested-pass · ❌ tested-fail (linked) · ⚠️ couldn't test completely.

### 1. Auth and access control

- ✅ Empty login validation and invalid-credential handling on Student login; invalid auth displayed the generic error and stayed on the page.
- ⚠️ Valid Student/Admin login, logout, session persistence, token refresh/expiry, and invalid stored-session handling — needs the two credentials listed above.
- ✅ Direct logged-out navigation to all 18 protected pages redirected to the correct login; public/home/login pages had no unhandled console error.
- ⚠️ Student direct access to Admin pages and student-token RLS — needs a student token.
- ✅ Anonymous `questions`/`student_questions`/`admin_questions` answer-field probes and pre-submission `get_attempt_review` denial behaved as logged above.
- ❌ Authenticated answer-leak/access-control design paths: [QA-001](#qa-001--question-bank-reveals-assigned-test-answers-before-test-submission), [QA-002](#qa-002--student-can-manufacture-an-unassigned-attempt-and-extract-its-answer-key), [QA-003](#qa-003--create-student-auto-assigns-class-scoped-tests-to-every-new-student).

### 2. Full Student journey

- ⚠️ Valid login → dashboard → Test A → all four modules — no student credential/seeded attempt.
- ⚠️ Eliminator, calculator/Desmos, reference sheet, timer visibility, text size, shortcuts, normal-module reload — code/UI inspected; authenticated interaction unavailable.
- ❌ Break reload/background timing: [QA-009](#qa-009--break-state-is-not-resumable-and-its-clock-pauses-in-the-background); server timing integrity: [QA-012](#qa-012--graded-test-time-limits-are-enforced-only-in-the-client).
- ⚠️ Timer at 0:00 — code shows blocking “Time's up” overlay and manual Continue, but live attempt unavailable.
- ⚠️ Submit/results (per-question times, slow labels, topic/difficulty bars) and print report — data-dependent page and print CSS inspected; no submitted attempt.
- ⚠️ Mistakes practice hides answers until Check — source/RPC gating passes; live missed question unavailable. Offline Check fails [QA-017](#qa-017--multiple-networked-actions-have-no-failure-state).
- ❌ SPR edge cases: normal equivalence (`3/4`, `0.75`, `.75`, whitespace) passed live pure-RPC; malformed accepted values and six-character/syntax limits failed [QA-005](#qa-005--malformed-spr-values-can-be-configured-and-graded-correct), [QA-014](#qa-014--spr-entry-allows-six-characters-and-invalid-number-syntax). Blank is rejected by client/source and scorer.
- ❌ Vocabulary quiz/progress: [QA-018](#qa-018--vocabulary-progress-is-race-prone-and-streaks-never-accumulate).
- ❌ Question Bank: [QA-001](#qa-001--question-bank-reveals-assigned-test-answers-before-test-submission), [QA-010](#qa-010--question-bank-does-not-render-question-images), [QA-015](#qa-015--question-bank-check-feedback-omits-the-correct-answer), [QA-016](#qa-016--exiting-question-bank-leaves-an-active-session-orphaned).
- ⚠️ Leaderboard with/without attempts — static empty state inspected; authenticated rows unavailable.

### 3. Full Admin journey

- ⚠️ Create student, class/member, image upload, publish/assign, leaderboard/dashboard stats, students/tests/vocabulary CRUD — needs admin credentials and mutation approval.
- ❌ New-student class scope: [QA-003](#qa-003--create-student-auto-assigns-class-scoped-tests-to-every-new-student).
- ❌ Question Bank and existing SPR editing: [QA-008](#qa-008--live-admin_questions-view-is-missing-spr-columns).
- ❌ Builder topic/explanation and malformed SPR validation: [QA-011](#qa-011--test-builder-has-no-topic-or-explanation-editor), [QA-005](#qa-005--malformed-spr-values-can-be-configured-and-graded-correct).
- ✅ Builder source validation rejects missing name, empty test, blank stem, incomplete MCQ choices, missing MCQ correct choice, and blank SPR accepted-answer text.
- ✅ Duplicate class assignment source path uses `resolution=ignore-duplicates` and patches the existing due date.
- ❌ Safe republish/history: [QA-006](#qa-006--republishing-a-test-deletes-historical-attempt-answers).
- ❌ Dashboard “Select students” option: [QA-019](#qa-019--new-test-assign-to-selection-is-ignored).

### 4. Data integrity and edge inputs

- ⚠️ XSS runtime injection into DB fields — no write credential. Static render audit found DB free text consistently sent through `escapeHtml`/`textContent`; `safeImageUrl` allows only HTTP(S). No unescaped free-text sink was confirmed.
- ⚠️ Empty DB states — static empty-state branches exist for new students, classes, tests, leaderboards, results, practice, Question Bank, and vocabulary; live empty records were not available.
- ⚠️ Very long strings, emoji/unicode, SQL-like text, exam date past/future — requires write access. Schema has no general text-length caps; no concrete rendering failure was reported without reproduction.
- ✅ Target score boundaries are enforced client-side and by `set_target_score()` at 400–1600.
- ❌ Test duration integrity lacks server constraints/enforcement: [QA-012](#qa-012--graded-test-time-limits-are-enforced-only-in-the-client).
- ⚠️ Same attempt twice/double submit/two tabs — RPC row lock/status check and client `isSubmitting` were inspected, but live concurrency requires a student attempt. URL cross-wiring already fails [QA-007](#qa-007--mismatched-testid-and-attemptid-submit-and-score-the-wrong-test).

### 5. UI, responsive, and accessibility

- ⚠️ All 21 static page shells were rendered at a 375px content width and desktop width with no document-level horizontal overflow; authenticated dynamic tables/cards could not be populated. Tables use internal horizontal scroll containers.
- ❌ Dark mode on every page: [QA-013](#qa-013--dark-mode-is-unavailable-on-every-page).
- ⚠️ Mobile drawer visual shell rendered; full signed-in link/focus interaction unavailable. Accessibility fails [QA-022](#qa-022--core-controls-are-not-keyboard-operable-and-images-lack-useful-alt-text).
- ❌ Keyboard-only controls, focus semantics, and image alt text: [QA-022](#qa-022--core-controls-are-not-keyboard-operable-and-images-lack-useful-alt-text).
- ⚠️ Download report invokes `window.print()` and print CSS expands question bodies/hides controls; no submitted result was available for final print-preview QA.
- ✅ Static link/asset validation found no missing file-backed internal link/image/script/style.
- ❌ Network still contains missing favicon [QA-026](#qa-026--every-browser-visit-requests-a-missing-favicon) and dead Settings anchor [QA-025](#qa-025--admin-settings-link-is-a-dead-anchor).

### 6. Robustness

- ❌ Offline/dropped-network behavior for multiple actions: [QA-017](#qa-017--multiple-networked-actions-have-no-failure-state). Start-test and final-submit do have explicit catch/retry messaging in source.
- ⚠️ Refresh at every test step — normal module state is persisted in source; live data unavailable, and break refresh fails [QA-009](#qa-009--break-state-is-not-resumable-and-its-clock-pauses-in-the-background).
- ⚠️ Browser Back/Forward mid-test and after submit — requires a live attempt.

## Page coverage

| Page | Result |
|---|---|
| `index.html` | ✅ Served, desktop/mobile shell rendered, console clean; favicon 404 is QA-026. |
| `admin-login.html` | ✅ Served; empty/invalid validation inspected. Valid login ⚠️. |
| `student-login.html` | ✅ Served; empty and invalid login reproduced. Valid login ⚠️. |
| `admin-dashboard.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-019/023/025/027. |
| `admin-students.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-003/023. |
| `admin-classes.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-017/021. |
| `admin-tests.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️. |
| `admin-test-builder.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated mutation ⚠️; QA-005/006/008/011. |
| `admin-question-bank.html` | ✅ Logged-out redirect; static shell. Live view defect confirmed by REST: QA-008. |
| `admin-vocabulary.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-017/020. |
| `admin-leaderboard.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-020. |
| `student-home.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-020. |
| `student-tests.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️. |
| `student-test-solve.html` | ✅ Logged-out redirect; static desktop/375px shell. Live attempt ⚠️; QA-007/009/012/014/022. |
| `student-results.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️. |
| `student-test-results.html` | ✅ Logged-out redirect; static desktop/375px/print source. Submitted review ⚠️; QA-022. |
| `student-practice.html` | ✅ Logged-out redirect; static desktop/375px shell. Missed data ⚠️; QA-017. |
| `student-classes.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️. |
| `student-question-bank.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-001/010/015/016/017. |
| `student-vocabulary.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-017/018/020. |
| `student-leaderboard.html` | ✅ Logged-out redirect; static desktop/375px shell. Authenticated data ⚠️; QA-020. |

## JavaScript module coverage

All 26 files passed `node --check`. Browser loading covered every page-owned module through the real server; logged-out protected modules correctly stopped behind `SAT_AUTH_READY`. Data-dependent behavior was then traced against schema/RPCs.

| Module | Result / linked findings |
|---|---|
| `js/admin-classes.js` | Inspected fully — QA-017, QA-020, QA-021. |
| `js/admin-dashboard.js` | Inspected fully — QA-003, QA-019, QA-020, QA-027. |
| `js/admin-leaderboard.js` | Inspected fully — QA-020. |
| `js/admin-login.js` | Browser invalid/empty paths + source pass; valid login ⚠️. |
| `js/admin-question-bank.js` | Live backing-view failure — QA-008. |
| `js/admin-students.js` | Inspected fully — QA-003, QA-023. |
| `js/admin-test-builder.js` | Inspected fully — QA-005, QA-006, QA-008, QA-011, QA-022. |
| `js/admin-tests.js` | Inspected fully — unbounded tests read included in QA-020. |
| `js/admin-vocabulary.js` | Inspected fully — QA-017, QA-020. |
| `js/auth-guard.js` | Browser-tested on every protected page while logged out; correct redirects, no unhandled error. Student/admin-role path ⚠️. |
| `js/badges.js` | Inspected fully; no standalone defect confirmed. |
| `js/mobile-nav.js` | Static mobile shell + source — QA-022. |
| `js/sat-config.js` | Inspected fully; no standalone defect confirmed. |
| `js/shared.js` | Escaping, safe image URL, logout helpers inspected; logout live path ⚠️. |
| `js/student-classes.js` | Inspected fully; live data/RPC path ⚠️. |
| `js/student-home.js` | Inspected fully — QA-020; live dashboard ⚠️. |
| `js/student-leaderboard.js` | Inspected fully — QA-020; live rows ⚠️. |
| `js/student-login.js` | Browser empty/invalid paths reproduced; valid login ⚠️. |
| `js/student-practice.js` | Inspected fully — QA-014, QA-017; live mistake data ⚠️. |
| `js/student-question-bank.js` | Inspected fully — QA-001, QA-010, QA-014, QA-015, QA-016, QA-017, QA-020. |
| `js/student-results.js` | Inspected fully; live attempt list ⚠️. |
| `js/student-test-results.js` | Inspected fully — QA-022; print CSS/source pass, live review ⚠️. |
| `js/student-test-solve.js` | Inspected fully — QA-007, QA-009, QA-012, QA-014, QA-022. |
| `js/student-tests.js` | Inspected fully; start/resume error branch present, live attempt ⚠️. |
| `js/student-vocabulary.js` | Inspected fully — QA-017, QA-018, QA-020. |
| `js/theme.js` | Module logic inspected, but never loaded and no dark CSS — QA-013. |

## Console and network baseline

- Public homepage: no JavaScript console errors.
- All protected direct URLs: successful local HTML/CSS/JS loads followed by the expected login redirect; no unhandled console error.
- Invalid Student login: handled Supabase Auth error logged by `student-login.js` and generic visible error; page remained usable.
- Local assets: all referenced file-backed HTML/CSS/JS/images resolved; `/favicon.ico` was the only routine 404.
- Live Supabase: answer-boundary responses and stale `admin_questions` errors are recorded at the top and in QA-005/QA-008.
- Authenticated `select=*` calls could not appear in a logged-out network trace; static request inventory is documented in QA-020.
