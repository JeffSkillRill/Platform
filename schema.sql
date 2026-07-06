-- ================================================================
-- SAT Platform — Legacy Prototype Schema
-- Run this in Supabase SQL Editor
-- ================================================================
-- SECURITY NOTE:
-- This schema is kept only so the current static HTML prototype still
-- matches the existing Supabase tables. It stores plain-text passwords
-- and uses allow-all RLS policies, so it is not safe for production.
--
-- For the next secure version, use schema-secure-v2.sql and migrate login
-- to Supabase Auth before enabling production users.
-- ================================================================

-- 1. USERS (students + admin)
create table if not exists users (
  id         uuid default gen_random_uuid() primary key,
  full_name  text not null,
  username   text unique not null,
  password   text not null,
  role       text not null default 'student' check (role in ('admin','student')),
  created_at timestamptz default now()
);

-- Default admin account
insert into users (full_name, username, password, role)
values ('Admin', 'admin', 'admin123', 'admin')
on conflict (username) do nothing;

-- 2. TESTS
create table if not exists tests (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  status     text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz default now()
);

-- 3. QUESTIONS
create table if not exists questions (
  id          uuid default gen_random_uuid() primary key,
  test_id     uuid not null references tests(id) on delete cascade,
  section     text not null check (section in ('math','rw')),
  module_key  text not null default 'rw1' check (module_key in ('rw1','rw2','math1','math2')),
  difficulty  text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  stem        text not null,
  image_url   text,
  choices     jsonb not null,
  correct     int  not null,
  order_num   int  not null default 0,
  created_at  timestamptz default now()
);

-- 4. SUBMISSIONS
create table if not exists submissions (
  id          uuid default gen_random_uuid() primary key,
  student_id  uuid not null references users(id) on delete cascade,
  test_id     uuid not null references tests(id) on delete cascade,
  answers     jsonb not null,   -- {"question_id": chosen_index, ...}
  time_taken  int  not null default 0,  -- seconds
  submitted_at timestamptz default now()
);

-- ---- Row Level Security (allow all for now) ----
alter table users       enable row level security;
alter table tests       enable row level security;
alter table questions   enable row level security;
alter table submissions enable row level security;

create policy "allow_all_users"       on users       for all using (true) with check (true);
create policy "allow_all_tests"       on tests       for all using (true) with check (true);
create policy "allow_all_questions"   on questions   for all using (true) with check (true);
create policy "allow_all_submissions" on submissions for all using (true) with check (true);
