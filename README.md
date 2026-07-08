# SAT Platform

Static SAT practice platform with separate Admin and Student portals backed by Supabase Auth, Postgres, RLS, RPC scoring, and Storage for question images.

## Supabase Setup

1. Open Supabase SQL Editor and run `schema.sql`.
2. In Supabase Auth, create your real admin user. If you log in as `admin`, create the Auth email as `admin@satprep.local` unless you change `SAT_AUTH_EMAIL_DOMAIN`.
3. Insert the matching admin profile:

```sql
insert into public.profiles (id, full_name, username, role)
values ('AUTH_USER_ID_HERE', 'Admin Name', 'admin', 'admin');
```

4. Deploy the Edge Function in `supabase/functions/create-student`. Short version:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SAT_AUTH_EMAIL_DOMAIN=satprep.local
supabase functions deploy create-student --use-api
```

See `docs/deploy-create-student-function.md` for details.

5. Create a public Supabase Storage bucket named `question-images`.
6. Optional: run `seed-demo-test.sql` after students exist. It creates a demo test and assigns it to active students.
7. Rotate the Supabase anon key in the dashboard if the old key was ever committed publicly, then update `supabase-config.js`.

## Local Use

This project is plain HTML/CSS/JS. You can open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Page Map

- Public homepage: `index.html`
- Student: `student-login.html`, `student-home.html`, `student-tests.html`, `student-test-solve.html`, `student-results.html`, `student-test-results.html`, `student-leaderboard.html`
- Admin: `admin-login.html`, `admin-dashboard.html`, `admin-students.html`, `admin-tests.html`, `admin-test-builder.html`, `admin-leaderboard.html`

## Security Notes

- Browser login uses Supabase Auth, not the legacy `users.password` table.
- Protected pages load `js/auth-guard.js` and enforce the role from `profiles`.
- Student test solving reads from `student_questions`; correct answers are returned only after submission through `get_attempt_review()`.
- Test scoring happens in `submit_attempt()` on the database side.
- Student creation requires the Edge Function because the service role key must never be placed in frontend code.
