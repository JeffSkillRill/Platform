# Deploy `create-student`

The admin panel creates students through a Supabase Edge Function because creating Auth users requires a privileged key. Never put the service role key in browser JavaScript.

## What This Function Does

`supabase/functions/create-student/index.ts`:

- verifies the logged-in caller is an active admin in `public.profiles`
- creates a Supabase Auth user
- creates the matching `public.profiles` row with `role = 'student'`
- assigns all currently published tests to the new student
- returns the username/email so the admin panel can show the one-time credentials

## Deploy With Supabase CLI

From the project folder:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SAT_AUTH_EMAIL_DOMAIN=satprep.local
supabase functions deploy create-student --use-api
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available automatically in hosted Supabase Edge Functions. `SAT_AUTH_EMAIL_DOMAIN` is optional because the function defaults to `satprep.local`, but setting it keeps the behavior explicit.

## Test From The App

1. Log in to `admin-login.html`.
2. Open `admin-students.html`.
3. Click **Add student**.
4. Enter name, username, and password.
5. Click **Create account**.

If it succeeds, the user will appear in Authentication > Users and in the `public.profiles` table.

## If You See An Error

- `Admin access required.` means your logged-in admin Auth user does not have `role = 'admin'` in `public.profiles`.
- `Username is already taken.` means a `profiles.username` row already exists.
- `Student creation is not ready yet...` means the Edge Function is not deployed or the function URL is blocked.
