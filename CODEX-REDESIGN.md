# Prompt for Codex — Platform Redesign + Classes, Vocabulary, Question Bank

Copy everything below into Codex.

---

Redesign the entire SAT platform UI to a clean, minimal, monochrome design system (reference: dsatuz.com), and add three features: **Classes**, **Vocabulary**, and **Question Bank**. Do NOT add any pricing/pro-plan/upgrade elements anywhere, and do NOT build a "Study Plan" feature. Preserve the existing security model: students never receive `correct`/`explanation`/accepted answers before committing an answer; all sensitive reads go through the existing security-definer RPCs pattern. Keep vanilla HTML/CSS/JS, no build step.

## 1. Design system (applies to every page)

Create one shared stylesheet `css/base.css`, loaded before each page stylesheet, containing tokens and shared components. Migrate all pages to it and strip the per-page duplicates.

**Tokens**
- Background: `#F8F9FB` (app), `#FFFFFF` (cards/sidebar)
- Ink: `#0B0F19` (primary text + primary buttons), `#4B5563` (muted), `#9CA3AF` (faint)
- Borders: `#E5E7EB`, 1px; dashed variant for empty states
- Accent chips: blue `#2563EB` on `#EFF6FF`, green `#16A34A` on `#ECFDF5`, yellow `#A16207` on `#FEFCE8`, red `#DC2626` on `#FEF2F2`
- Radius: cards 16px, buttons 10px, pills/chips 999px
- Shadow: subtle only — `0 1px 2px rgba(16,24,40,.06)`; slightly stronger on hover
- Font: Inter (already loaded); page titles ~28px/800, section titles 16px/700, body 14px, labels 11–12px uppercase tracking for stat captions
- Buttons: primary = solid `#0B0F19` with white text; secondary = white with 1px border; both 10px radius, 40–44px tall, optional leading icon

**Shared components (one markup pattern + CSS class each)**
- `sidebar`: fixed left, white, 260px. Top: brand wordmark (italic-style bold "SAT PREP" or the platform name) + collapse toggle. "MENU" micro-label. Nav items: icon + label, 40px rows; ACTIVE item = full dark pill (`#0B0F19` background, white text, 12px radius). Small count/status badges on the right of items (e.g. green "Free"-style chip → reuse for counts). Bottom section pinned: Performance/Results link, Support (mailto), Settings, and the user card with logout. Include the existing streak/goal data if available: a bordered "Daily Streak" mini-card with progress bar sits between nav and bottom section (hide it gracefully if streak data isn't implemented yet). NO "Upgrade to Pro" button.
- `page-header`: big bold title + one-line muted subtitle; optional bell icon placeholder right-aligned.
- `card`: white, border, 16px radius, 24px padding.
- `stat-box`: bordered inset box with tiny uppercase caption + large bold value (used in pairs/rows inside cards).
- `pill-tabs`: horizontal filter bar; active tab = dark pill with count badge, inactive = plain text with muted count chip.
- `tag`: small dot + label chip (blue/green/yellow variants).
- `empty-state`: dashed 2px border card, centered gray icon, bold one-liner, muted helper line.
- `banner-cta`: full-width dark (`#0B0F19`) rounded banner with white headline, muted subline, white pill button on the right.
- Floating action button bottom-right (dark circle, white icon) — used by Vocabulary quick-add; render only where relevant.

Both student and admin areas use the same design system (admin keeps its own nav items).

## 2. Page-by-page redesign (existing pages)

- **index.html** — restyle hero/landing to match: white, big type, dark primary buttons, bordered feature cards. No pricing section.
- **student-home.html → "Dashboard"** — Header "Dashboard / Welcome back, {name}". Content:
  1. "Daily Practice" card: icon + title + subtitle, a row of three bordered mini-tiles (e.g. "Continue where you left off", "Track progress", "Instant feedback" — wire the first tile to a real in-progress attempt if one exists), and a dark `banner-cta` ("Ready to practice? → Start now" linking to tests).
  2. Two-column row: **Exam Countdown** card (user sets their exam date; big bordered digit tiles DAYS/HOURS/MINUTES/SECONDS ticking live; "Change date" link; store date in `profiles.exam_date date` via migration) and **Your Target Score** card (huge centered number, "Change" dark button; use `profiles.target_score` — add the column if not already added).
  3. Keep existing stats (best score, section scores, tests done, average, rank) restyled as a row of `stat-box`es, and the recent tests + leaderboard preview lists restyled as bordered list rows.
- **student-tests.html → "Your Practice Papers"** — Header + subtitle. `pill-tabs`: All Papers (count) / New / In Progress / Completed (counts). Sort dropdown (Newest to Oldest, Oldest to Newest). Card grid (3 columns desktop, 1 mobile): each test card has icon + name, `tag` pills (difficulty/status e.g. "New", "In progress"), two `stat-box`es — "People took" (count of distinct students with submitted attempts, expose via a safe aggregated view) and "Your last score" (score or "Not taken", with last-taken date) — then a full-width dark "Start Test / Resume / Review" button.
- **student-test-solve** — keep exam functionality identical; restyle chrome to the design system (white bars, dark pills, bordered question card, dark primary buttons).
- **student-test-results / student-results** — restyle with `card`, `stat-box` rows, `pill-tabs` for the correct/wrong/skipped filter.
- **student-leaderboard / admin pages (dashboard, students, tests, builder, leaderboard)** — restyle to the same system: page headers, cards, pill tabs, dark primary buttons, bordered tables with 44px rows. Admin nav: Dashboard, Students, Classes, Tests, Question Bank, Vocabulary, Leaderboard.

## 3. Classes (new feature — required)

Purpose now: organize students into groups. Purpose later: teacher–student communication (design the schema so messaging can be added without rework, but do NOT build messaging now).

**Migration `migrations/0XX-classes.sql`** (idempotent, RLS):
```
classes: id, name, description, teacher_id -> profiles (admin), join_code text unique, is_archived bool, created_at
class_members: id, class_id, student_id -> profiles, added_by, joined_at, unique(class_id, student_id)
test_assignments: add nullable class_id -> classes (class-wide assignment; keep existing per-student rows working)
```
RLS: admins full on both; students select their own memberships and the classes they belong to. Students must also see tests assigned to their class: extend the assignment-based policies (tests/questions visibility) so `test_assignments.student_id = auth.uid() OR test_assignments.class_id IN (select class_id from class_members where student_id = auth.uid())`.

**Admin UI `admin-classes.html`**: card grid of classes (name, teacher, member count, join code chip); create/edit modal; class detail view with member table (add/remove students via picker); assign-test-to-class action (writes one class-level assignment row). Admin test builder's assignment step gains a "assign to class" option.

**Student UI `student-classes.html` → "My Learning Space"**: header "My Learning Space / Access your class materials and track your progress." If no memberships → `empty-state`: "No classes yet / Once your teacher adds you, your class will appear here." Otherwise: one card per class showing class name, teacher name, classmates count, and the tests assigned to that class with status/score chips. Add "Classes" to the student sidebar.

## 4. Vocabulary (new feature)

**Migration `migrations/0XX-vocabulary.sql`**:
```
vocab_lists: id, title, description, owner_id -> profiles, scope text check in ('admin','personal'), class_id nullable -> classes, created_at
vocab_words: id, list_id, word, definition, synonyms jsonb, antonyms jsonb, example text, created_at
vocab_progress: id, student_id, word_id, status text check in ('new','learning','known'), last_reviewed_at, correct_streak int, unique(student_id, word_id)
```
RLS: admin lists readable by all authenticated; personal lists owner-only; class-scoped lists readable by that class's members; vocab_progress student-own.

**Student UI `student-vocabulary.html` → "Vocabulary"**: header "Build your vocabulary with personal words and teacher assignments."
- "Offered by Admins" card: admin/class lists as rows (truncated title, "N words" chip, "Study" button).
- "My Vocabulary (N)" collapsible section: personal words; add/edit/delete word modal (word, definition, synonyms/antonyms as comma-separated → chips, example).
- Search bar filtering all visible words.
- Empty state matching the design ("Your Vocabulary is Empty").
- **List view**: back arrow + list title + date + "Admin List" chip + "N words" counter; buttons "Practice Flashcards" (outline) and "Take Quiz" (blue primary); responsive grid of word cards — word in blue bold, then Definition, Synonyms (chips), Antonyms (chips).
- **Flashcards**: full-screen card flip (word → definition + synonyms/antonyms), Again/Good buttons updating `vocab_progress`.
- **Quiz**: 10 random words from the list, 4-choice definition matching (distractors = other words'' definitions from the same list), client-graded (vocab is not exam-secure content), result summary + progress updates.
- Floating quick-add button (dark circle, bottom-right) opening the add-word modal on vocabulary pages.

**Admin UI**: manage admin lists and words (CRUD), optionally scope a list to a class.

## 5. Question Bank (new feature)

Reuses the existing `questions` table — no new question storage. Practice sessions draw from questions belonging to **published tests the student can access**, via the existing student-safe view (never expose `correct` client-side).

**Migration `migrations/0XX-question-bank.sql`**:
```
practice_sessions: id, student_id, filters jsonb, question_ids uuid[], answered int default 0, correct int default 0, status text check in ('active','finished'), created_at, finished_at
practice_answers: id, session_id, question_id, chosen int, chosen_text text, is_correct bool, answered_at, unique(session_id, question_id)
RPC check_practice_answer(p_session_id, p_question_id, p_chosen, p_chosen_text) — security definer: validates session ownership, grades server-side, records the answer, returns {is_correct, correct, explanation}
RPC get_bank_stats() — per-student totals: questions available, answered, correct, by section/topic/difficulty
```
RLS: sessions/answers student-own.

**Student UI `student-question-bank.html` → "Create Your Session"**: header + subtitle. Top row: two `stat-box` cards — "Progress: X% (N of M answered)" and "Total time spent" (sum of session time; track per-answer client timing). "General Filters" card row: Difficulty (Easy/Medium/Hard toggle pills), Answered status (Correct/Incorrect/Not answered), Marked for review (Yes/No — reuse flag data if available, else omit). "Browse by Subject": two accordion cards — Math and Reading & Writing with live question counts; expanding shows topics with counts, checkboxes, and per-topic instant "play" buttons; a sticky "Start Session" button builds a session from the selected filters (default 10 questions, shuffled).
**Session view**: one question at a time in the design-system question card, choice list (or SPR input if implemented), "Check" → server-graded instant feedback with explanation, then "Next"; session summary at the end (score, accuracy by topic, "New session" button). Add "Question Bank" to the student sidebar.

## 6. Rules

- No pricing, plans, upgrade banners, or "Pro" copy anywhere. No Study Plan feature or nav item.
- Escape all db-sourced strings (`window.escapeHtml`); `data-` attributes + `addEventListener` for new interactivity; keep pages working at 375px width (sidebar collapses to a hamburger/off-canvas).
- Exam content stays server-graded; vocabulary quizzes may grade client-side.
- Migrations idempotent with RLS, listed in README with run order. Update README nav/page map.
- Work in this order and report after each step: (1) base.css + sidebar/header shell on all pages, (2) student pages restyle, (3) admin pages restyle, (4) Classes, (5) Question Bank, (6) Vocabulary.

## 7. Acceptance checks

- [ ] Every page uses base.css tokens; no page defines its own color palette; zero "Upgrade/Pro/Study Plan" strings in the repo.
- [ ] Sidebar active state is a dark pill; Classes, Question Bank, Vocabulary appear in student nav; admin nav updated.
- [ ] Dashboard shows working exam countdown (persisted date) and target score cards.
- [ ] Practice Papers tabs (All/New/In Progress/Completed) filter correctly; cards show "People took" and "Your last score".
- [ ] A student added to a class sees it in My Learning Space; a test assigned to the class becomes visible/startable for all its members; students not in the class cannot fetch it.
- [ ] Question Bank sessions never expose `correct` in network traffic before "Check"; explanations appear only after answering.
- [ ] Vocabulary: admin list renders as word-card grid; flashcards and quiz work; personal words are private to their owner.
- [ ] All pages usable at 375px; test-solve exam flow behaves exactly as before, only restyled.
