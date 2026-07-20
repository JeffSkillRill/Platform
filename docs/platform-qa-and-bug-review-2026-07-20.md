# Platform QA and Bug Review Report

## 1. Executive Summary

The student portal is usable for navigation, assigned-test discovery, dashboard viewing, dark mode, empty states, and responsive layouts. Before fixes, the repository contained release-blocking authorization and exam-integrity gaps in attempt creation/submission, Question Bank answer isolation, new-student assignment defaults, grid-in validation, and attempt/test URL binding. Local fixes now cover those paths, but the database migration has **not** been deployed and the live administrator account is rejected, so the live platform must still be treated as exposed to the original server-side risks.

- Issues found: **19** — Critical 6, High 3, Medium 5, Low 4, Suggestion 1.
- Fixed and verified: **4**.
- Fixed but partially verified: **9**.
- Blocked: **2**.
- Deferred or still confirmed: **4**.
- Most serious remaining risks: migration 008 is not deployed; authoritative SAT scoring uses a placeholder formula; administrator access is blocked.
- Core workflows working: student login, role redirect, dashboard, assigned-test list, class/practice/results empty states, leaderboard, theme persistence, shared logout after fix, and responsive layouts without horizontal page overflow.
- Core workflows blocked/unreliable: all live administrator CRUD, full course/test creation, end-to-end submission/grading, Question Bank server enforcement until migration deployment, and score accuracy.
- Release recommendation: **Not Ready**.

Five most important findings:

1. Attempt authorization must be enforced by migration 008 before release (BUG-001).
2. Question Bank answer access must be restricted to submitted tests on the server (BUG-002).
3. New-student creation must not auto-assign class-scoped tests (BUG-003).
4. Displayed SAT scores are based on a known placeholder formula (BUG-004).
5. The supplied administrator account cannot authenticate, blocking all admin acceptance testing (BUG-007).

## 2. Testing Information

| Item | Value |
|---|---|
| Platform URL | `http://127.0.0.1:5173` (local static files using the configured live Supabase backend) |
| Test date | 2026-07-20 |
| Environment | Local static server; remote configured Auth/Postgres/RLS/RPC backend; no deploy performed |
| Browser | Codex in-app Browser; Chromium version not exposed by the test surface |
| Operating system | macOS 26.5.1, build 25F80 |
| Screen sizes | Default approximately 1265×720; explicit 375×900, 768×900, 1366×900, 1920×900 |
| Platform version/build | Not present in UI or repository metadata |
| Accounts tested | Authorized student account: authenticated; authorized administrator account: attempted twice and rejected |
| Modules tested | Public home, both login pages, student home/tests/classes/question bank/vocabulary/practice/results/leaderboard, logout, role redirect, dark mode, responsive layouts, repository/RLS/RPC/source review |
| Modules not fully tested | Authenticated admin pages, live CRUD/publish/enroll/deactivate, full test completion/scoring, file upload, admin reports, database migration execution |
| Data policy | No new student, class, test, attempt, submission, vocabulary item, file, announcement, or production configuration was created or deleted |

Testing limitations:

- The administrator credentials were rejected twice; no alternate account or password guessing was attempted.
- Student writes that would create attempts or practice rows were avoided because the connected backend may be production and cleanup was impossible without admin access.
- No second student/class account was available for cross-record ID testing.
- Browser network waterfall, token storage, screen-reader output, a second browser engine, email/password reset, and true expired-session simulation were unavailable.
- SQL migration 008 was created locally but not executed. SQL behavior is therefore source/static-verified, not deployed-runtime-verified.

## 3. Feature Coverage

| Module | Admin Tested | Student Tested | Status | Notes |
|---|---|---|---|---|
| Public home/navigation | N/A | Yes | Passed | Links, headings, local assets, desktop/mobile render checked |
| Authentication/login | Blocked | Yes | Passed with Issues | Admin rejected; student login/session succeeded; validation fixed |
| Logout/session | Blocked | Yes | Passed with Issues | Shared logout added and protected pages redirected after logout |
| Role access | Source/direct URL | Yes | Passed with Issues | Student admin URL redirected; server hardening still requires migration 008 |
| Admin dashboard | Blocked | N/A | Blocked | Administrator login unavailable |
| Student dashboard/progress | N/A | Yes | Passed | Live dashboard data and empty progress state rendered |
| Students/staff | Blocked | N/A | Blocked | Source reviewed; staff management is not implemented |
| Classes/enrollment | Blocked | Yes | Blocked | Student empty state passed; admin create/edit/member workflow blocked |
| Tests/test builder | Source only | Yes | Passed with Issues | Two assigned tests visible; safe full attempt creation was not performed |
| Test solving/timer/resume | Source only | Guard only | Blocked | Invalid attempt rejected; full 144-minute flow not run |
| Scoring/results | Source only | Empty state | Failed | Placeholder scoring remains a release blocker |
| Question Bank | Source only | Yes | Passed with Issues | Client isolation verified; server migration not deployed |
| Practice mistakes | N/A | Yes | Passed | No-mistakes empty state; answer mutation not performed |
| Vocabulary | Blocked | Yes | Passed with Issues | Student list rendered; write/quiz progress not mutated |
| Leaderboard | Blocked | Yes | Passed with Issues | Student table rendered; reads are unbounded |
| File upload/download | Blocked | Not Tested | Not Tested | Requires admin workflow/submitted result fixture |
| Announcements/notifications | Not available | Not available | Not Tested | Feature not present in repository |
| Attendance/certificates | Not available | Not available | Not Tested | Feature not present in repository |
| Settings/password reset | Not available | Not available | Failed | Settings is a dead link; reset workflow absent |
| Responsive UI | Blocked | Yes | Passed with Issues | No page-level horizontal overflow; touch targets need improvement |
| Accessibility | Source only | Yes | Passed with Issues | Login semantics fixed; remaining keyboard/touch issues documented |

## 4. Issue Summary

| Bug ID | Title | Module | Role | Severity | Priority | Original Status | Final Status |
|---|---|---|---|---|---|---|---|
| BUG-001 | Unassigned tests can be turned into submitted attempts | Permissions | Student | Critical | P0 | Confirmed | Fixed but Partially Verified |
| BUG-002 | Question Bank exposes answers before submission | Question Bank | Student | Critical | P0 | Confirmed | Fixed but Partially Verified |
| BUG-003 | New students receive every published test | Student admin | Admin | Critical | P0 | Confirmed | Fixed but Partially Verified |
| BUG-004 | Placeholder formula is presented as SAT score | Scoring | Both | Critical | P0 | Confirmed | Blocked |
| BUG-005 | Malformed SPR values can grade correct | Scoring | Both | Critical | P0 | Confirmed | Fixed but Partially Verified |
| BUG-006 | Solver accepts unrelated test/attempt IDs | Test solve | Student | Critical | P0 | Confirmed | Fixed but Partially Verified |
| BUG-007 | Provided admin account is rejected | Auth | Admin | High | P1 | Confirmed | Blocked |
| BUG-008 | Question Bank omits question images | Question Bank | Student | High | P1 | Confirmed | Fixed but Partially Verified |
| BUG-009 | Builder cannot edit topic/explanation | Test builder | Admin | High | P1 | Confirmed | Fixed but Partially Verified |
| BUG-010 | Practice feedback omits correct answer | Question Bank | Student | Medium | P2 | Confirmed | Fixed but Partially Verified |
| BUG-011 | Exiting Question Bank orphans session | Question Bank | Student | Medium | P2 | Confirmed | Fixed but Partially Verified |
| BUG-012 | Most protected pages have no logout | Navigation | Both | Medium | P2 | Confirmed | Fixed and Verified |
| BUG-013 | Major reads are unbounded/select=* | Performance | Both | Medium | P2 | Confirmed | Deferred |
| BUG-014 | Admin mutation failures can be silent | Error handling | Admin | Medium | P2 | Confirmed | Deferred |
| BUG-015 | Login errors lack ARIA/focus association | Accessibility | Both | Low | P2 | Confirmed | Fixed and Verified |
| BUG-016 | Mobile touch targets are below 44px | Accessibility | Student | Low | P3 | Confirmed | Confirmed |
| BUG-017 | Admin Settings is a dead link | Navigation | Admin | Low | P3 | Confirmed | Deferred |
| BUG-018 | Setup documentation is stale | Documentation | Owner | Suggestion | P3 | Confirmed | Fixed and Verified |
| BUG-019 | Disabled Question Bank Start looks enabled | Question Bank | Student | Low | P3 | Confirmed | Fixed and Verified |

## 5. Detailed Bug and Fix Reports

### BUG-001: Unassigned tests can be turned into submitted attempts

- Original severity: Critical
- Final severity: Critical until migration 008 is deployed
- Priority: P0
- Category: Authorization / answer integrity
- Module: Attempts and scoring RPC
- User role: Student
- Environment: Active SQL definitions; local migration only
- Page/URL: `student-tests.html`, `submit_attempt`
- Frequency: Deterministic from the active policy/function
- Final status: Fixed but Partially Verified
- Preconditions: Authenticated student and a test not assigned to that student

#### Original Steps to Reproduce

1. Insert an own `in_progress` attempt referencing an unassigned test ID.
2. Call `submit_attempt` for that attempt.
3. Request the submitted attempt review.

#### Original Expected Result

Insert and submission are rejected unless the test is published and assigned directly or through the student's class.

#### Original Actual Result

The insert policy checked only student ownership/status; the security-definer submit function trusted the attempt's test ID.

#### Evidence Before Fix

`schema.sql` and migration 001 contain the incomplete checks. No destructive live exploit was performed.

#### Root Cause

Authorization was enforced at UI/test reads but not at the attempt write boundary or privileged status transition.

#### Fix Implemented

`migrations/008-security-and-practice-hardening.sql` adds `student_has_test_access`, replaces the insert policy, and adds a trigger that rechecks caller, assignment, publication, and student ID on insert/submission.

#### Verification Steps

1. Ran static migration assertions.
2. Ran JS/source syntax checks.
3. Reviewed direct/class assignment logic against migration 004.

#### Verification Result

Local definition is complete; runtime verification is pending deployment.

#### Evidence After Fix

`node tests/qa-static-checks.mjs` passed.

#### Regression Testing

Student published-test listing and invalid-attempt rejection remained functional.

#### User Impact

Prevents unauthorized answer-key extraction and fabricated attempts.

#### Remaining Risks

The live backend remains at risk until migration 008 is applied and tested with two students/classes.

#### Retest Criteria

Unassigned insert/submission returns authorization failure; assigned direct and class attempts still start and submit.

### BUG-002: Question Bank exposes answers before a graded test is submitted

- Original severity: Critical
- Final severity: Critical until server migration deployment
- Priority: P0
- Category: Authorization / exam integrity
- Module: Question Bank
- User role: Student
- Environment: Local UI plus active SQL review
- Page/URL: `student-question-bank.html`, `check_practice_answer`
- Frequency: Deterministic
- Final status: Fixed but Partially Verified
- Preconditions: Assigned published test with no submitted attempt

#### Original Steps to Reproduce

1. Sign in as the authorized student with two assigned, unsubmitted tests.
2. Open Question Bank.
3. Observe that all 196 assigned questions are offered; checking one would invoke an RPC returning the answer.

#### Original Expected Result

Only questions from already-submitted tests are eligible for answer-revealing practice.

#### Original Actual Result

The UI offered 196 questions and the RPC required assignment, not prior submission.

#### Evidence Before Fix

Browser snapshot and `student-question-bank.js`/migration 005 call chain.

#### Root Cause

Practice eligibility was equated with test assignment.

#### Fix Implemented

The client filters by submitted attempts and disables Start when no eligible questions exist. Migration 008 adds the same submitted-attempt condition to stats and the answer RPC.

#### Verification Steps

1. Reopened Question Bank as the same student.
2. Confirmed Math (0), R&W (0), progress 0/0, no Play buttons.
3. Confirmed Start is disabled.

#### Verification Result

Client behavior is fixed and verified; direct RPC enforcement awaits migration deployment.

#### Evidence After Fix

`qa-evidence-2026-07-20/question-bank-no-submitted-tests.png`; computed disabled state.

#### Regression Testing

Page/auth/theme/navigation still render; local static checks pass.

#### User Impact

Protects graded answers before submission.

#### Remaining Risks

A crafted direct RPC remains a concern until migration 008 is live.

#### Retest Criteria

Unsubmitted test questions are absent in UI and direct RPC calls fail; submitted-test practice still works.

### BUG-003: New student creation auto-assigns every published test

- Original severity: Critical
- Final severity: Critical until Edge Function redeployment
- Priority: P0
- Category: Authorization / privacy
- Module: Student creation
- User role: Admin
- Environment: Edge Function source review
- Page/URL: `create-student`
- Frequency: Every omitted flag
- Final status: Fixed but Partially Verified
- Preconditions: Published class-scoped tests exist

#### Original Steps to Reproduce

1. Create a student from the existing admin form.
2. Do not send `assign_existing_tests`.
3. Inspect direct assignments.

#### Original Expected Result

No existing tests are assigned without explicit opt-in.

#### Original Actual Result

Omitting the flag enabled assignment of every published test.

#### Evidence Before Fix

`body.assign_existing_tests !== false` in the Edge Function.

#### Root Cause

An unsafe default bypassed class scope.

#### Fix Implemented

Default changed to strict opt-in: `body.assign_existing_tests === true`.

#### Verification Steps

Static regression check verifies the default; no deployment or user creation was performed.

#### Verification Result

Fixed locally, partially verified.

#### Evidence After Fix

Static test passed.

#### Regression Testing

Authorization/profile checks in the function were preserved.

#### User Impact

Prevents new students receiving unrelated class tests.

#### Remaining Risks

Edge Function must be redeployed and explicitly tested with class-only fixtures.

#### Retest Criteria

Default creation has zero direct assignments; explicit opt-in is the only path that assigns global tests.

### BUG-004: Placeholder linear formula is presented as an SAT score

- Original severity: Critical
- Final severity: Critical
- Priority: P0
- Category: Incorrect calculation
- Module: Scoring
- User role: Student/Admin
- Environment: SQL source review
- Page/URL: `submit_attempt`, results/dashboard/leaderboards
- Frequency: Every submitted attempt
- Final status: Blocked
- Preconditions: Any submitted test

#### Original Steps to Reproduce

1. Compute a section's percent correct.
2. Compare it with the stored formula `200 + round(percent * 600)`.
3. Observe the UI labels it as an SAT score.

#### Original Expected Result

Use an approved test-form conversion or clearly label an estimate.

#### Original Actual Result

The implementation is a straight-line placeholder.

#### Evidence Before Fix

`schema.sql` and migration 001 scoring code.

#### Root Cause

No versioned SAT conversion data/business rule exists.

#### Fix Implemented

None. A safe fix requires product-approved scoring tables or a labeling decision.

#### Verification Steps

Reviewed all score consumers and confirmed they present the value as authoritative.

#### Verification Result

Unresolved.

#### Evidence After Fix

Not applicable.

#### Regression Testing

Not applicable.

#### User Impact

Students and instructors may act on materially inaccurate scores.

#### Remaining Risks

This remains a release blocker.

#### Retest Criteria

Approved raw-to-scaled fixtures match every test form, including boundary scores.

### BUG-005: Malformed SPR values can be configured and graded correct

- Original severity: Critical
- Final severity: Critical until migration deployment
- Priority: P0
- Category: Validation / grading
- Module: Builder and scoring
- User role: Admin/Student
- Environment: Source/SQL review
- Page/URL: Builder; `sat_spr_is_correct`
- Frequency: Deterministic for malformed exact matches
- Final status: Fixed but Partially Verified
- Preconditions: SPR question

#### Original Steps to Reproduce

1. Configure `1/0` or `1..2` as accepted text.
2. Submit the identical malformed text.
3. Observe old exact-string branch returns true.

#### Original Expected Result

Both authored answers and responses must be valid five-character numeric forms.

#### Original Actual Result

Exact string equality occurred before numeric validation.

#### Evidence Before Fix

Migration 001 scorer and six-character client inputs.

#### Root Cause

Sanitization filtered characters but did not validate syntax; scorer trusted exact text.

#### Fix Implemented

Migration 008 adds immutable accepted-answer validation and numeric-only comparison plus a `NOT VALID` constraint enforced for new/updated rows. Builder, solver, practice, and Question Bank now cap at five characters; builder rejects invalid tokens.

#### Verification Steps

Static checks validated all client/migration guards; JS syntax passed.

#### Verification Result

Fixed locally; database runtime pending.

#### Evidence After Fix

`node tests/qa-static-checks.mjs` passed.

#### Regression Testing

Valid examples `3/4`, `0.75`, `.75` remain accepted by the numeric parser design.

#### User Impact

Prevents invalid answer keys and wrong grading.

#### Remaining Risks

Existing invalid rows are not validated automatically; run an audit before validating the constraint.

#### Retest Criteria

Malformed inputs fail; valid fraction/decimal equivalents grade equal within 0.001.

### BUG-006: Solver accepts unrelated testId and attemptId parameters

- Original severity: Critical
- Final severity: Critical until valid-pair regression completes
- Priority: P0
- Category: Data integrity
- Module: Test solver
- User role: Student
- Environment: Local UI/source
- Page/URL: `student-test-solve.html`
- Frequency: Deterministic for a mismatch
- Final status: Fixed but Partially Verified
- Preconditions: Student supplies inconsistent URL parameters

#### Original Steps to Reproduce

1. Use one test ID and another attempt ID in the solver URL.
2. Load questions.
3. Submit through the attempt RPC.

#### Original Expected Result

Attempt ownership/status/test relation is verified before questions load.

#### Original Actual Result

Old code used independent URL values.

#### Evidence Before Fix

Control-flow review of old `init`, `loadTest`, and `submitTest`.

#### Root Cause

The attempt row was never loaded by the solver.

#### Fix Implemented

Added `validateAttempt()` before `loadTest()` and explicit `attempt.test_id !== testId` rejection.

#### Verification Steps

Opened a valid assigned test ID with a nonexistent attempt ID; zero questions loaded and submission controls were unavailable.

#### Verification Result

Invalid relationship guard verified; valid attempt/resume path is pending a disposable attempt.

#### Evidence After Fix

Browser result: “Failed to load…” and question count 0; static check confirms comparison.

#### Regression Testing

Student test list remained available.

#### User Impact

Prevents scoring one attempt against another test's visible questions.

#### Remaining Risks

Server migration 008 is still required as defense in depth.

#### Retest Criteria

Mismatch sends no question/submit action; valid own in-progress attempt resumes.

### BUG-007: Provided administrator test account is rejected

- Original severity: High
- Final severity: High
- Priority: P1
- Category: Environment / authentication
- Module: Admin portal
- User role: Admin
- Environment: Live configured Auth backend
- Page/URL: `admin-login.html`
- Frequency: 2/2 attempts
- Final status: Blocked
- Preconditions: Supplied authorized credential

#### Original Steps to Reproduce

1. Open Admin Login.
2. Enter the supplied credential.
3. Submit.

#### Original Expected Result

Admin dashboard opens.

#### Original Actual Result

“Incorrect username or password. Try again.”

#### Evidence Before Fix

`qa-evidence-2026-07-20/admin-login-rejected.png`.

#### Root Cause

Unknown without Auth dashboard access; likely credential/account state mismatch rather than client normalization.

#### Fix Implemented

None; changing authentication data is outside local repository authority.

#### Verification Steps

Repeated once with the same authorized credential; no variants or guessing attempted.

#### Verification Result

Blocked.

#### Evidence After Fix

Not applicable.

#### Regression Testing

Student login remained successful.

#### User Impact

All authenticated admin acceptance tests are unavailable.

#### Remaining Risks

Admin CRUD and admin-side security cannot be release-certified.

#### Retest Criteria

Owner supplies a working active admin account/profile and all admin modules are rerun.

### BUG-008: Question Bank omits question images

- Original severity: High
- Final severity: High until fixture verification
- Priority: P1
- Category: Functional/accessibility
- Module: Question Bank
- User role: Student
- Environment: Source review
- Page/URL: `student-question-bank.html`
- Frequency: Every image-dependent practice question
- Final status: Fixed but Partially Verified
- Preconditions: Eligible submitted question with `image_url`

#### Original Steps to Reproduce

1. Open an image-dependent practice question.
2. Observe `image_url` is fetched.
3. Observe old render output omitted an image.

#### Original Expected Result

Safe image renders with an accessible name.

#### Original Actual Result

Image was discarded.

#### Evidence Before Fix

Deterministic `renderQuestion()` source review.

#### Root Cause

Fetched field was not mapped into markup.

#### Fix Implemented

Render `safeImageUrl` with escaped URL and non-empty alt text; solver images received the same accessible name.

#### Verification Steps

Static assertions and local-file checks passed.

#### Verification Result

Partially verified; no safe submitted image fixture existed.

#### Evidence After Fix

Source/static test output.

#### Regression Testing

Zero-question Question Bank still renders correctly.

#### User Impact

Restores answerability for graph/figure questions.

#### Remaining Risks

Author-specific alt text is not stored; fallback remains generic.

#### Retest Criteria

Fixture image loads, fits responsive layout, has useful authored/fallback alt text, and does not expose unsafe URLs.

### BUG-009: Builder cannot edit topic or explanation

- Original severity: High
- Final severity: High until admin verification
- Priority: P1
- Category: Missing functionality
- Module: Test builder
- User role: Admin
- Environment: Source review
- Page/URL: `admin-test-builder.html`
- Frequency: Every question
- Final status: Fixed but Partially Verified
- Preconditions: Admin builder access

#### Original Steps to Reproduce

1. Add or edit a question.
2. Try to set topic.
3. Try to set explanation.

#### Original Expected Result

Both fields round-trip and publish.

#### Original Actual Result

No controls existed, although payload and result views use the fields.

#### Evidence Before Fix

HTML/source inventory.

#### Root Cause

Model fields were never exposed in the form.

#### Fix Implemented

Added `qTopic` and `qExplanation`; initialized, loaded, collected, and preserved values.

#### Verification Steps

Static field/wiring checks and JS syntax checks passed.

#### Verification Result

Partially verified; live admin publish blocked.

#### Evidence After Fix

Static regression output.

#### Regression Testing

Existing publish payload mapping remains unchanged.

#### User Impact

Restores topic analytics and answer feedback authoring.

#### Remaining Risks

Needs live edit/reopen/student-feedback round trip.

#### Retest Criteria

Values persist through save/publish/reopen and appear in student results/practice.

### BUG-010: Question Bank wrong-answer feedback omits the correct answer

- Original severity: Medium
- Final severity: Medium until fixture verification
- Priority: P2
- Category: UX / feedback
- Module: Question Bank
- User role: Student
- Environment: Source review
- Page/URL: `student-question-bank.html`
- Frequency: Every wrong answer lacking explanatory text
- Final status: Fixed but Partially Verified
- Preconditions: Eligible practice question

#### Original Steps to Reproduce

1. Choose a wrong answer.
2. Click Check.
3. Read feedback.

#### Original Expected Result

Correct choice/accepted response is identified after Check.

#### Original Actual Result

UI rendered only “Not quite” and optional explanation.

#### Evidence Before Fix

RPC/UI response mapping review.

#### Root Cause

`correct`/`answer_text` were ignored by rendering.

#### Fix Implemented

Render “Answer: Choice X” or accepted SPR text only after feedback exists.

#### Verification Steps

Static output-guard assertions passed.

#### Verification Result

Partially verified; no safe practice write performed.

#### Evidence After Fix

Static check passed.

#### Regression Testing

Answer values are absent before Check.

#### User Impact

Makes practice corrective instead of merely evaluative.

#### Remaining Risks

Needs MCQ and SPR live fixtures.

#### Retest Criteria

Wrong MCQ and SPR feedback show correct answer; no key appears before successful Check.

### BUG-011: Exiting Question Bank leaves an active session orphaned

- Original severity: Medium
- Final severity: Medium until migration deployment
- Priority: P2
- Category: Data consistency
- Module: Question Bank
- User role: Student
- Environment: Source/SQL review
- Page/URL: Question Bank / `practice_sessions`
- Frequency: Every early exit
- Final status: Fixed but Partially Verified
- Preconditions: Active session

#### Original Steps to Reproduce

1. Start a session.
2. Exit before completion.
3. Inspect session row.

#### Original Expected Result

Session is finished/abandoned or resumable.

#### Original Actual Result

UI discarded state while row remained active.

#### Evidence Before Fix

Old Exit handler called only `renderSetup()`.

#### Root Cause

No authorized finish endpoint existed.

#### Fix Implemented

Migration 008 adds owner-scoped `finish_practice_session`; Exit calls it with loading/error recovery.

#### Verification Steps

Static RPC/client checks passed.

#### Verification Result

Partially verified; database runtime pending.

#### Evidence After Fix

Static test output.

#### Regression Testing

Zero-question setup and disabled Start were rechecked.

#### User Impact

Prevents misleading active-session data.

#### Remaining Risks

Migration must be deployed before the new client Exit path is usable.

#### Retest Criteria

Exit sets `finished` and `finished_at`; network failure retains the current session and shows retry guidance.

### BUG-012: Most protected pages have no logout action

- Original severity: Medium
- Final severity: Low after fix
- Priority: P2
- Category: Session usability
- Module: Shared navigation
- User role: Admin/Student
- Environment: Source and browser
- Page/URL: Most protected portal pages
- Frequency: 16 protected pages affected
- Final status: Fixed and Verified
- Preconditions: Signed-in session

#### Original Steps to Reproduce

1. Open Student Tests or Classes.
2. Inspect the sidebar.
3. Try to sign out without returning Home.

#### Original Expected Result

Every protected sidebar exposes Sign out.

#### Original Actual Result

Only three HTML pages contained a logout control.

#### Evidence Before Fix

Repository inventory.

#### Root Cause

Sidebar markup was duplicated and inconsistent.

#### Fix Implemented

`mobile-nav.js` injects one role-aware button when missing; `mobile.css` supplies a 44px visible/focusable style; all affected cache keys were bumped.

#### Verification Steps

1. Reloaded Student Tests.
2. Confirmed one Sign out button.
3. Activated logout; a later protected-page sweep redirected to Student Login.

#### Verification Result

Fixed and verified.

#### Evidence After Fix

Question Bank screenshot includes the shared Sign out control.

#### Regression Testing

Mobile drawer open/resize cleanup and portal navigation remained functional.

#### User Impact

Users can reliably end sessions on shared devices.

#### Remaining Risks

Admin action needs live verification once admin access works.

#### Retest Criteria

Exactly one correct-role logout control appears on every sidebar and sign-out invalidates protected-page access.

### BUG-013: Major list pages use unbounded select=* reads

- Original severity: Medium
- Final severity: Medium
- Priority: P2
- Category: Performance / data minimization
- Module: Vocabulary, leaderboard, classes, tests, dashboards
- User role: Both
- Environment: Source review
- Page/URL: Multiple
- Frequency: Every load; impact grows with data
- Final status: Deferred
- Preconditions: Growing production data

#### Original Steps to Reproduce

1. Inspect network/query construction on list pages.
2. Observe `select=*` without range/limit.
3. Grow datasets and reload.

#### Original Expected Result

Explicit columns and bounded pagination.

#### Original Actual Result

Multiple full-table reads remain.

#### Evidence Before Fix

Source search listed 16 unbounded/select-all calls.

#### Root Cause

Initial small-dataset implementation lacks pagination contracts.

#### Fix Implemented

None; safe correction spans UI pagination, counts, current-user leaderboard inclusion, and backend contracts.

#### Verification Steps

Static inventory only.

#### Verification Result

Unresolved.

#### Evidence After Fix

Not applicable.

#### Regression Testing

Not applicable.

#### User Impact

Slower loads and larger data exposure as usage grows.

#### Remaining Risks

Potential PostgREST row-limit truncation can silently produce incomplete UI.

#### Retest Criteria

Every list request is bounded, paginated, and column-limited with correct empty/end states.

### BUG-014: Network failures are silent for multiple admin mutations

- Original severity: Medium
- Final severity: Medium
- Priority: P2
- Category: Error handling
- Module: Admin classes/vocabulary
- User role: Admin
- Environment: Source review
- Page/URL: Admin mutation pages
- Frequency: When requests fail
- Final status: Deferred
- Preconditions: Network/API error

#### Original Steps to Reproduce

1. Drop the network during add/remove/assign/save.
2. Trigger the action.
3. Observe missing user-visible recovery on several handlers.

#### Original Expected Result

Specific error, re-enabled control, and safe retry.

#### Original Actual Result

Unhandled rejection or stale UI is possible.

#### Evidence Before Fix

`admin-classes.js` and `admin-vocabulary.js` handlers without catches.

#### Root Cause

Mutation handlers lack a shared error boundary.

#### Fix Implemented

None; admin runtime was unavailable and a consistent cross-module pattern is required.

#### Verification Steps

Source review only.

#### Verification Result

Unresolved.

#### Evidence After Fix

Not applicable.

#### Regression Testing

Not applicable.

#### User Impact

Admins may repeat operations and create duplicates or uncertainty.

#### Remaining Risks

Highest on membership, assignment, and vocabulary writes.

#### Retest Criteria

Every mutation failure is visible, controls recover, input remains, and retry is idempotent.

### BUG-015: Login field errors are not programmatically associated or focused

- Original severity: Low
- Final severity: Low
- Priority: P2
- Category: Accessibility / validation
- Module: Authentication
- User role: Admin/Student
- Environment: Browser
- Page/URL: Both login pages
- Frequency: 2/2 roles
- Final status: Fixed and Verified
- Preconditions: Empty login form

#### Original Steps to Reproduce

1. Submit empty form.
2. Inspect focus and input semantics.
3. Repeat on other role.

#### Original Expected Result

First invalid field is focused and errors are associated/announced.

#### Original Actual Result

Focus stayed on submit; fields lacked `required`, `aria-describedby`, and `aria-invalid`.

#### Evidence Before Fix

Browser output for both roles.

#### Root Cause

Validation was visual-only.

#### Fix Implemented

Added required/error/alert semantics, `aria-invalid` lifecycle, and first-invalid focus.

#### Verification Steps

Submitted empty forms after hard reload on both login pages.

#### Verification Result

Fixed and verified.

#### Evidence After Fix

Both pages report `required=true`, correct `aria-describedby`, `aria-invalid=true`, and active element `username`.

#### Regression Testing

Student valid login still succeeds; admin error remains specific.

#### User Impact

Improves keyboard and screen-reader recovery.

#### Remaining Risks

Full screen-reader announcement was not audited.

#### Retest Criteria

Automated semantics/focus assertions and manual screen-reader check pass.

### BUG-016: Several mobile touch targets are below 44px

- Original severity: Low
- Final severity: Low
- Priority: P3
- Category: Accessibility / responsive UX
- Module: Student portal
- User role: Student
- Environment: 375px and 768px
- Page/URL: Multiple
- Frequency: Consistent
- Final status: Confirmed
- Preconditions: Mobile/tablet viewport

#### Original Steps to Reproduce

1. Open key student pages at 375/768.
2. Measure visible controls.
3. Compare with approximately 44px target guidance.

#### Original Expected Result

Primary targets are comfortably tappable.

#### Original Actual Result

Examples include 40px menu, 36px theme, 34px Study, and a 13px legacy Sign out control before shared replacement.

#### Evidence Before Fix

Responsive geometry sweep and mobile screenshot.

#### Root Cause

Desktop-sized button rules carry into mobile layouts.

#### Fix Implemented

Shared injected logout is now 44px; remaining controls were not broadly restyled to avoid unrelated visual changes.

#### Verification Steps

Rechecked no page-level horizontal overflow at four widths.

#### Verification Result

Partially improved; issue remains.

#### Evidence After Fix

`student-home-375-viewport.png`.

#### Regression Testing

Mobile drawer and content layout passed.

#### User Impact

Higher mis-tap risk.

#### Remaining Risks

Needs device touch testing, not only geometry.

#### Retest Criteria

All primary mobile targets meet the chosen minimum and remain visually balanced.

### BUG-017: Admin Settings navigation is a dead link

- Original severity: Low
- Final severity: Low
- Priority: P3
- Category: UX / navigation
- Module: Admin dashboard
- User role: Admin
- Environment: Source review
- Page/URL: `admin-dashboard.html`
- Frequency: Always
- Final status: Deferred
- Preconditions: Admin navigation

#### Original Steps to Reproduce

1. Locate Settings.
2. Activate it.
3. Observe `href="#"`.

#### Original Expected Result

A real settings workflow opens or the item is absent.

#### Original Actual Result

It is a dead navigation target.

#### Evidence Before Fix

Static href inspection.

#### Root Cause

Placeholder navigation shipped without a module.

#### Fix Implemented

None; product must decide whether to implement or remove it.

#### Verification Steps

Source inspection only.

#### Verification Result

Unresolved.

#### Evidence After Fix

Not applicable.

#### Regression Testing

Not applicable.

#### User Impact

Misleading action and unnecessary keyboard stop.

#### Remaining Risks

Password/account settings are also absent.

#### Retest Criteria

Settings opens a tested workflow or no placeholder is rendered.

### BUG-018: Repository setup documentation was out of date

- Original severity: Suggestion
- Final severity: Suggestion
- Priority: P3
- Category: Maintainability
- Module: Documentation
- User role: Owner/developer
- Environment: Repository
- Page/URL: `README.md`
- Frequency: Every setup
- Final status: Fixed and Verified
- Preconditions: Fresh deployment/setup

#### Original Steps to Reproduce

1. Follow README migration list.
2. Compare it with repository migrations/pages.
3. Observe migrations 003+ and current modules missing.

#### Original Expected Result

README describes complete setup/order.

#### Original Actual Result

It stopped at migrations 001–002 and an older page map.

#### Evidence Before Fix

README/repository comparison.

#### Root Cause

Documentation was not updated with feature growth.

#### Fix Implemented

Documented migrations 001–008, current portals, seed order, theme, and deployment guide.

#### Verification Steps

Static local-reference checks passed.

#### Verification Result

Fixed and verified.

#### Evidence After Fix

README diff and passing static test.

#### Regression Testing

All referenced local files exist.

#### User Impact

Reduces broken deployments and missed security migrations.

#### Remaining Risks

Migration 008 still requires owner deployment.

#### Retest Criteria

Fresh setup completes from README without missing objects or pages.

### BUG-019: Disabled Question Bank Start action looks enabled

- Original severity: Low
- Final severity: Low
- Priority: P3
- Category: UX / state clarity
- Module: Question Bank
- User role: Student
- Environment: Browser
- Page/URL: `student-question-bank.html`
- Frequency: Every zero-question state
- Final status: Fixed and Verified
- Preconditions: No eligible submitted-test questions

#### Original Steps to Reproduce

1. Open Question Bank with zero eligible questions.
2. Observe Start is disabled in DOM.
3. Observe it looks like an enabled primary button.

#### Original Expected Result

Disabled action is visibly distinct.

#### Original Actual Result

No disabled styling existed.

#### Evidence Before Fix

Initial Question Bank screenshot and CSS inspection.

#### Root Cause

Page button CSS defined hover/primary styles but no `:disabled` state.

#### Fix Implemented

Added reduced opacity and `not-allowed` cursor; versioned stylesheet URL.

#### Verification Steps

Reopened page and inspected computed style.

#### Verification Result

Fixed and verified.

#### Evidence After Fix

`disabled=true`, opacity `0.45`, cursor `not-allowed`.

#### Regression Testing

Empty state, dark mode, and shared logout still render.

#### User Impact

Reduces false affordance and confusion.

#### Remaining Risks

The page would benefit from explanatory empty-state copy next to the disabled button.

#### Retest Criteria

Disabled state is visually obvious in light/dark themes and cannot be activated.

## 6. Security and Permission Observations

Confirmed security bugs:

- BUG-001, BUG-002, BUG-003, BUG-005, and BUG-006 are confirmed from complete client/SQL call chains; fixes are local and require deployment/runtime retest.
- A student direct-navigation attempt to `admin-dashboard.html` was redirected to `admin-login.html` after role evaluation. No admin mutation control became usable and no direct admin API call was made.
- No hard-coded service-role/private key was found. The Edge Function reads its service-role key from the runtime environment.

Unconfirmed concerns/limitations:

- Direct authenticated REST/RPC tamper tests were intentionally not executed because token/session-store inspection was unavailable and no disposable backend was provided.
- Another student's record IDs were not tested because only one student account was authorized.
- Default Supabase browser-session storage was not inspected. A focused XSS/CSP review is still recommended because browser-stored tokens increase the impact of client-side script injection.
- Migration 007 appears required for the live `admin_questions` view, but authenticated admin verification was blocked.

## 7. UX and Accessibility Findings

- Login: BUG-015 fixed; fields now expose required/error semantics and focus recovery.
- Navigation: BUG-012 fixed; logout is consistent. BUG-017 remains a dead admin link.
- Question Bank: pre-submission state now accurately shows 0 eligible questions; disabled action is visually clear. Image/feedback/session fixes need a submitted fixture.
- Responsive: no page-level horizontal overflow was detected across eight student pages at 375, 768, 1366, and 1920 widths. Several controls remain below the preferred touch size (BUG-016).
- Keyboard: source still contains clickable `div` controls in test solving/results/builder. These should be converted to native buttons or receive complete keyboard semantics in a dedicated accessibility pass.
- Images: logo alt/accessibility names passed; question images now have a fallback name, but authored descriptive alt text is not modeled.
- Dark mode: toggle worked and persisted across student pages; contrast was visually sampled, not measured with a contrast analyzer.

## 8. Performance and Technical Findings

- BUG-013 documents unbounded reads and `select=*` usage.
- No new page-specific JavaScript errors were observed during the successful student sweep. One logged `AuthApiError` corresponded to the deliberately reproduced rejected admin login.
- Question Bank required multiple backend round trips and took roughly several seconds before full data rendering in this environment; no formal performance budget/waterfall was available.
- The active homepage uses `assets/home-hero.jpg` (about 184 KB); the unused legacy PNG remains about 1.6 MB.
- Local asset/link verification passed. No build pipeline or dependency manifest exists; the app is static HTML/CSS/JS.
- The multi-request builder publish flow remains non-transactional even after local reliability fixes. A server-side transaction/RPC is the longer-term safety direction.

## 9. Successful Test Cases

- Public homepage navigation and assets load.
- Student login succeeds and persists across protected-page navigation.
- Empty login submissions show specific field errors; post-fix ARIA/focus behavior passes on both roles.
- Student dashboard renders assigned-test, leaderboard, goal, badge, and empty-progress data.
- Two assigned tests render with correct 98-question/R&W/Math counts.
- Student Classes, Practice, and Results show coherent empty states.
- Student Vocabulary and Leaderboard pages load without page-level console failures.
- Direct student navigation to the admin dashboard redirects to admin login.
- Dark mode toggles and persists.
- Eight student pages show no document-level horizontal overflow at all four target widths.
- Mobile drawer opens and clears after leaving the mobile breakpoint.
- Post-fix logout invalidates protected-page navigation.
- Post-fix Question Bank excludes all 196 questions from unsubmitted tests, shows 0/0, and disables Start.
- Invalid solver attempt ID loads zero questions.
- All local HTML asset references resolve.

## 10. Recommended Fix Order

1. Immediate critical fixes
   - Deploy migrations 007 and 008 to a staging/disposable Supabase project.
   - Redeploy the updated `create-student` Edge Function.
   - Retest BUG-001/002/003/005/006 with two students and two classes.
   - Replace or relabel placeholder scoring (BUG-004).
2. Fixes required before release
   - Restore a working admin QA account and run all admin workflows.
   - Live-verify builder topic/explanation, image questions, feedback, and session finish.
   - Add consistent admin mutation error recovery.
3. Important post-release fixes
   - Paginate/column-limit list APIs.
   - Increase mobile touch targets and replace clickable `div` controls.
   - Remove or implement Admin Settings.
4. Future improvements
   - Add authored image alt text, automated browser E2E, screen-reader checks, and a transactional publish RPC.

## 11. Final Release Recommendation

**Not Ready.** Local code quality is improved, but release approval is blocked by an undeployed security migration, a known inaccurate scoring algorithm, invalid administrator test access, and incomplete runtime verification of the core admin → assignment → submission → grading workflow.

## 12. Change Log

| Change ID | Bug ID | File | Change Summary | Reason | Verification | Status |
|---|---|---|---|---|---|---|
| CHANGE-001 | BUG-015 | Login HTML/JS | Added required/error/alert semantics and focus recovery | Accessible validation | Browser both roles + static tests | Verified |
| CHANGE-002 | BUG-012 | `js/mobile-nav.js`, `css/mobile.css`, protected HTML | Injected shared role-aware logout; bumped cache keys | Logout consistency | Browser count/session redirect | Verified |
| CHANGE-003 | BUG-001/002/005/011 | Migration 008 | Added attempt guard, practice eligibility, SPR validation, finish RPC | Security/data integrity | Static SQL contract checks | Partial |
| CHANGE-004 | BUG-003 | Edge Function | Made existing-test assignment opt-in | Preserve class scope | Static regression check | Partial |
| CHANGE-005 | BUG-006 | Solver | Validated attempt status/test before loading | Prevent mismatched scoring | Browser invalid attempt + static check | Partial |
| CHANGE-006 | BUG-002/008/010/011/019 | Question Bank JS/CSS/HTML | Filtered eligible questions; images; feedback; finish; disabled state | Security and usability | Browser empty state + static checks | Partial |
| CHANGE-007 | BUG-005 | Builder/solver/practice/QB | Five-character syntactic SPR guards | Correct grading | Static checks | Partial |
| CHANGE-008 | BUG-009 | Builder HTML/JS | Added topic/explanation fields | Complete authoring | Static wiring checks | Partial |
| CHANGE-009 | BUG-008 | Solver | Replaced empty meaningful-image alt | Accessibility | Static check | Partial |
| CHANGE-010 | BUG-018 | README | Synced migrations/pages/seeds/deploy notes | Safe setup | Local reference checks | Verified |
| CHANGE-011 | Multiple | `tests/qa-static-checks.mjs` | Added regression/source/link contract checks | Prevent recurrence | Command passed | Verified |

## 13. Test Log

| Test ID | Role | Module | Scenario | Result Before Fix | Result After Fix | Evidence |
|---|---|---|---|---|---|---|
| TEST-001 | Public | Home | Navigation/content load | Passed | Passed | DOM snapshot |
| TEST-002 | Student | Login | Valid sign-in | Passed | Passed | Redirect to home |
| TEST-003 | Admin | Login | Supplied credential | Failed | Blocked | Screenshot; 2/2 |
| TEST-004 | Both | Login | Empty fields | Visual-only errors | ARIA/focus passed | Browser field state |
| TEST-005 | Student | Permissions | Direct admin URL | Redirected | Redirected | Final admin-login URL |
| TEST-006 | Student | Home | Dashboard data/empty progress | Passed | Passed | DOM snapshot/mobile screenshot |
| TEST-007 | Student | Tests | Assigned list/counts | Passed | Passed | Two 98-question cards |
| TEST-008 | Student | Classes | Empty state | Passed | Passed | “No classes yet” |
| TEST-009 | Student | Question Bank | Unsubmitted eligibility | 196 offered | 0 offered; Start disabled | Browser state/screenshot |
| TEST-010 | Student | Solver | Invalid attempt URL | Old relationship unchecked | Zero questions loaded | Browser state |
| TEST-011 | Student | Navigation | Logout availability | Missing on most pages | One shared button | Browser count |
| TEST-012 | Student | Session | Protected access after logout | N/A | Redirected to login | Eight-page sweep |
| TEST-013 | Student | Theme | Toggle/persistence | Passed | Passed | Computed dark colors/theme attr |
| TEST-014 | Student | Responsive | 375/768/1366/1920 | No overflow; small targets | Same; logout improved | Geometry sweep |
| TEST-015 | Repository | JavaScript | Syntax check all `js/*.js` | Passed | Passed | `node --check` loop |
| TEST-016 | Repository | Regression | Security/UI/source contracts | Not present | Passed | `node tests/qa-static-checks.mjs` |
| TEST-017 | Repository | Git hygiene | Whitespace/error check | Passed | Passed | `git diff --check` |

## 14. Files Changed

| File | Related Bug IDs | Summary of Changes | Tests Performed |
|---|---|---|---|
| `README.md` | BUG-018 | Current migrations/routes/seeds/deploy notes | Static local-reference check |
| Login HTML + `js/admin-login.js`, `js/student-login.js` | BUG-015 | Accessible validation and cache versions | Browser both roles; syntax/static |
| `js/mobile-nav.js`, `css/mobile.css`, portal HTML | BUG-012 | Shared logout and cache versions | Browser control/session redirect |
| `migrations/008-security-and-practice-hardening.sql` | BUG-001/002/005/011 | Authorization, practice, SPR, finish RPC | Static SQL contract checks; not executed |
| `supabase/functions/create-student/index.ts` | BUG-003 | Safe opt-in assignment default | Static assertion |
| `js/student-test-solve.js`, HTML | BUG-005/006/008 | Attempt validation, SPR limit, image alt, cache version | Invalid-attempt browser test; syntax/static |
| `js/student-question-bank.js`, CSS, HTML | BUG-002/008/010/011/019 | Eligibility, images, feedback, session finish, disabled styling | Browser empty state/computed CSS; syntax/static |
| `js/student-practice.js`, HTML | BUG-005 | Five-character SPR input | Syntax/static |
| `js/admin-test-builder.js`, HTML | BUG-005/009 | SPR validation and topic/explanation fields | Syntax/static; admin runtime blocked |
| `tests/qa-static-checks.mjs` | Multiple | Regression and local-link checks | Passed |
| `docs/qa-evidence-2026-07-20/*` | BUG-002/007/012/016/019 | Browser screenshots | Visual inspection |
| This report and CSV | All | QA deliverables | Markdown/CSV inspection |

## 15. Automated Checks

| Check | Command | Result | Relevant error | Baseline/introduced |
|---|---|---|---|---|
| Unit/static regression | `node tests/qa-static-checks.mjs` | Passed | None | New check |
| JavaScript syntax | `for qa_js_file in js/*.js; do node --check "$qa_js_file" || exit 1; done` | Passed | None | Passed after changes |
| Diff whitespace | `git diff --check` | Passed | None | Passed after changes |
| Integration tests | Not configured | Not run | No test framework/backend fixture | Pre-existing limitation |
| Automated E2E | Not configured | Not run | Manual browser testing only | Pre-existing limitation |
| Type checking | Not configured | Not run | Deno unavailable; no JS/TS project config | Pre-existing limitation |
| Linting | Not configured | Not run | No lint config/package manifest | Pre-existing limitation |
| Production build | Not applicable | Not run | Static project has no build step | By design |
| Database migrations | Not authorized | Not run | Migration 008 must be owner-deployed | Expected limitation |
| Security checks | Source/static/manual | Passed locally with limitations | No live tamper exploit | Partial verification |

## 16. Manual Regression Checklist

- [ ] Restore admin test account; login/logout/reload/back/forward.
- [ ] Student login/logout/reload and direct admin URL redirect.
- [ ] Create `TEST Student`; confirm zero default test assignments; deactivate and clean up.
- [ ] Create/edit/archive `TEST Course`; enroll/remove test student; verify both roles.
- [ ] Build MCQ + SPR test with topic, explanation, image, due date, and class assignment.
- [ ] Confirm only assigned/class students see the test.
- [ ] Verify malformed SPR author values and student values are rejected.
- [ ] Start/resume/refresh test; timer, break, auto-submit, duplicate-submit, and two-tab behavior.
- [ ] Confirm mismatch/unassigned attempt insert and submission are rejected server-side.
- [ ] Submit known answers; manually calculate raw counts and compare approved scaled score.
- [ ] Verify admin sees submission; grade/feedback workflow if supported.
- [ ] Confirm student results, correct feedback, images, downloads, and practice set.
- [ ] Confirm Question Bank excludes unsubmitted tests and direct RPC cannot return their keys.
- [ ] Exit Question Bank early and confirm session is finished.
- [ ] Check vocabulary progress/error recovery and class assignment duplicates.
- [ ] Verify every portal page at 375/768/1366/1920 in light/dark modes.
- [ ] Keyboard-only pass: focus visibility/order, dialogs, clickable cards, result accordions, test answer choices.
- [ ] Network-offline pass for each mutation with retry/no duplicate.

## 17. Tests That Could Not Be Completed

- Administrator dashboard, student CRUD, classes, test publish, question bank admin, vocabulary admin, and reports: supplied admin credentials rejected.
- Full course/assignment/quiz end-to-end workflow: admin blocked and no safe disposable data path.
- Full 144-minute test, timeout, auto-submit, score review, resubmission, duplicate submission, two-tab concurrency: would create live attempts and lacked cleanup/admin access.
- File upload/download and invalid/oversized/duplicate files: no admin test fixture and upload would modify backend storage.
- Password reset/email/notifications: no implementation and real email sending prohibited.
- Announcements, attendance, certificates, staff/teacher management, manual grades: modules do not exist.
- Cross-student record-ID authorization: only one student account supplied.
- Expired session: no safe expiry-control mechanism.
- Second browser/screen reader: unavailable in this test environment.
- SQL migration/runtime checks: no authorized staging database or migration deployment.
- Browser token/storage inspection and full network waterfall: intentionally not accessed/available.

## 18. Remaining Issues

| Issue | Reason not fixed/fully verified | Risk | Required access/decision | Next action |
|---|---|---|---|---|
| BUG-001/002/005/011 server changes | Migration not deployed | Critical | Staging/owner SQL access | Apply 007/008 and run abuse/regression matrix |
| BUG-003 Edge Function | Not redeployed | Critical | Supabase deploy authority | Redeploy and create disposable student |
| BUG-004 scoring | Missing business rule/data | Critical | Approved conversion tables or labeling decision | Implement versioned scoring before release |
| BUG-006 valid resume | No disposable attempt | Critical | Staging student/test fixture | Test mismatch plus normal resume/submit |
| BUG-007 admin login | Account rejected | High | Auth dashboard/account reset | Repair account and rerun all admin modules |
| BUG-008/009/010 | No eligible admin/submitted fixture | High/Medium | Working admin and disposable test | Publish and round-trip fields/images/feedback |
| BUG-013 | Cross-module pagination design | Medium | API/UI decision | Add column-limited pagination |
| BUG-014 | Admin runtime unavailable | Medium | Working admin plus offline control | Add shared mutation error pattern |
| BUG-016 | Visual scope | Low | Design approval/device QA | Increase touch targets |
| BUG-017 | Product decision | Low | Implement/remove settings decision | Remove dead link or build module |

## 19. Git Change Summary

- Current branch: `main`.
- Initial repository status: already dirty with 8 tracked modified files and multiple untracked QA/docs/assets/migration files. All were preserved.
- Final repository status: dirty and uncommitted; this review adds local source, migration, test, evidence, report, and CSV changes.
- Modified tracked files at final review: `README.md`; all `admin-*.html` portal pages; `student-classes.html`, `student-home.html`, `student-leaderboard.html`, `student-login.html`, `student-practice.html`, `student-question-bank.html`, `student-results.html`, `student-test-solve.html`, `student-tests.html`, `student-vocabulary.html`; `css/index.css`, `css/mobile.css`, `css/student-question-bank.css`; `index.html`; `js/admin-login.js`, `js/admin-test-builder.js`, `js/mobile-nav.js`, `js/shared.js`, `js/student-login.js`, `js/student-practice.js`, `js/student-question-bank.js`, `js/student-test-solve.js`; and `supabase/functions/create-student/index.ts`.
- Newly created by this review: `docs/platform-qa-and-bug-review-2026-07-20.md`, `docs/platform-qa-bugs-2026-07-20.csv`, `docs/qa-evidence-2026-07-20/*`, `migrations/008-security-and-practice-hardening.sql`, and `tests/qa-static-checks.mjs`.
- Pre-existing tracked modifications, preserved and not wholly attributable to this review: `css/index.css`, `index.html`, `js/admin-login.js`, `js/admin-test-builder.js`, `js/shared.js`, `js/student-login.js`, `js/student-practice.js`, and `js/student-test-solve.js`. Where this review also changed one of these files, the relevant change is documented in the Change Log.
- Pre-existing untracked files, preserved: `.claude/launch.json`, `CODEX-ANIMATIONS.md`, `CODEX-BUGFIX.md`, `CODEX-QA-BUGHUNT.md`, `_headers`, `assets/home-hero.jpg`, `docs/qa-bug-report-2026-07-20.md`, `docs/qa-bug-report.md`, and `migrations/007-fix-admin-questions-view.sql`.
- Deleted files: none.
- No commit, push, PR, deploy, release, production configuration, or production cleanup action was performed.
- Concise future commit summary: harden attempt/practice authorization, validate SPR answers, complete builder metadata, improve shared auth/navigation accessibility, and add QA regression coverage.
- Recommended commit title: `fix: harden test authorization and QA-critical workflows`
- Recommended commit description: `Add assignment enforcement and practice isolation migration, safe student defaults, attempt binding, SPR validation, builder metadata fields, accessible login/logout behavior, Question Bank UX fixes, and static regression checks.`

CSV-compatible bug table: [platform-qa-bugs-2026-07-20.csv](platform-qa-bugs-2026-07-20.csv).

## 20. Final Approval Checkpoint

> Testing and local fixes are complete. No commits, pushes, deployments, or production changes have been made. The project is ready for owner review. I will not commit the changes until explicit commit permission is provided.
