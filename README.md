# SAT Platform

Static SAT practice platform with separate Admin and Student portals backed by Supabase Auth, Postgres, RLS, RPC scoring, and Storage for question images.

## Supabase Setup

1. Open Supabase SQL Editor and run `schema.sql`.
2. Run migrations in order:

```sql
-- migrations/001-spr-and-question-times.sql
-- migrations/002-practice-and-goals.sql
```

3. In Supabase Auth, create your real admin user. If you log in as `admin`, create the Auth email as `admin@satprep.local` unless you change `SAT_AUTH_EMAIL_DOMAIN`.
4. Insert the matching admin profile:

```sql
insert into public.profiles (id, full_name, username, role)
values ('AUTH_USER_ID_HERE', 'Admin Name', 'admin', 'admin');
```

5. Deploy the Edge Function in `supabase/functions/create-student`. Short version:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SAT_AUTH_EMAIL_DOMAIN=satprep.local
supabase functions deploy create-student --use-api
```

See `docs/deploy-create-student-function.md` for details.

6. Create a public Supabase Storage bucket named `question-images`.
7. Optional: run `seed-demo-test.sql` after students exist. It creates a demo test and assigns it to active students.
8. Rotate the Supabase anon key in the dashboard if the old key was ever committed publicly, then update `supabase-config.js`.

## Local Use

This project is plain HTML/CSS/JS. You can open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## 4Prep Brand

Pages load the shared `fourprep-logo` web component from `js/logo.js` and `css/logo.css`:

```html
<fourprep-logo size="40" variant="color"></fourprep-logo>
<fourprep-logo size="40" variant="white"></fourprep-logo>
```

Use `theme-aware` on logos that sit on a theme-changing surface. It resolves to the color mark in light mode and the white mark in dark mode. UI and metadata must reference the optimized files in `assets/brand/`, never the full-size source files in `logo/`.

## Page Map

- Public homepage: `index.html`
- Student: `student-login.html`, `student-home.html`, `student-tests.html`, `student-test-solve.html`, `student-results.html`, `student-test-results.html`, `student-leaderboard.html`
- Practice: `student-practice.html`
- Admin: `admin-login.html`, `admin-dashboard.html`, `admin-students.html`, `admin-tests.html`, `admin-test-builder.html`, `admin-leaderboard.html`

## Feature Migrations

- `001-spr-and-question-times.sql`: adds student-produced response questions, accepted answer text kept server-side, per-question timing, SPR grading helpers, updated `student_questions`, `submit_attempt()`, and `get_attempt_review()`.
- `002-practice-and-goals.sql`: adds `profiles.target_score`, `practice_events`, `get_mistake_questions()`, `check_practice_answer()`, and `set_target_score()`.

## Manual Test Checklist

- Phase 1: start a test, eliminate choices, hide timer, change text size, use keyboard shortcuts, refresh, and confirm the same state returns. In a Math module, open Calculator and Reference; confirm those buttons are hidden in R&W.
- Phase 1 SPR: create an SPR math question in the builder with `3/4,0.75,.75`, publish, answer `.75`, and confirm the submitted result is graded correct.
- Phase 2: submit a test and open results; confirm per-question time, slow-question labels, topic bars, and difficulty bars render. Open Practice and confirm missed questions appear without answers until Check.
- Phase 3: confirm Home shows trend, streak, badges, target goal, and due-date badges. Open `student-leaderboard.html?testId=TEST_ID` and confirm that test is preselected.
- Phase 4: use the sidebar Dark mode toggle, check student pages at mobile width, and use Download report on a result page to open the print view.

## Security Notes

- Browser login uses Supabase Auth, not the legacy `users.password` table.
- Protected pages load `js/auth-guard.js` and enforce the role from `profiles`.
- Student test solving reads from `student_questions`; correct answers are returned only after submission through `get_attempt_review()`.
- Test scoring happens in `submit_attempt()` on the database side.
- Student creation requires the Edge Function because the service role key must never be placed in frontend code.
