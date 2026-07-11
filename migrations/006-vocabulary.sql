-- ================================================================
-- 006 - Vocabulary lists, words, and progress
-- ================================================================

create table if not exists public.vocab_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('admin','personal')),
  class_id uuid references public.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vocab_words (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vocab_lists(id) on delete cascade,
  word text not null,
  definition text not null,
  synonyms jsonb not null default '[]'::jsonb,
  antonyms jsonb not null default '[]'::jsonb,
  example text,
  created_at timestamptz not null default now()
);

create table if not exists public.vocab_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  word_id uuid not null references public.vocab_words(id) on delete cascade,
  status text not null default 'new' check (status in ('new','learning','known')),
  last_reviewed_at timestamptz,
  correct_streak int not null default 0,
  unique(student_id, word_id)
);

alter table public.vocab_lists enable row level security;
alter table public.vocab_words enable row level security;
alter table public.vocab_progress enable row level security;

drop policy if exists "vocab_lists_admin_all" on public.vocab_lists;
drop policy if exists "vocab_lists_student_read" on public.vocab_lists;
drop policy if exists "vocab_lists_personal_write" on public.vocab_lists;
create policy "vocab_lists_admin_all" on public.vocab_lists
  for all using (public.is_admin()) with check (public.is_admin());
create policy "vocab_lists_student_read" on public.vocab_lists
  for select using (
    (scope = 'admin' and class_id is null)
    or owner_id = auth.uid()
    or class_id in (select cm.class_id from public.class_members cm where cm.student_id = auth.uid())
  );
create policy "vocab_lists_personal_write" on public.vocab_lists
  for all using (owner_id = auth.uid() and scope = 'personal')
  with check (owner_id = auth.uid() and scope = 'personal' and class_id is null);

drop policy if exists "vocab_words_admin_all" on public.vocab_words;
drop policy if exists "vocab_words_student_read" on public.vocab_words;
create policy "vocab_words_admin_all" on public.vocab_words
  for all using (public.is_admin()) with check (public.is_admin());
create policy "vocab_words_student_read" on public.vocab_words
  for select using (
    exists (
      select 1 from public.vocab_lists vl
      where vl.id = vocab_words.list_id
        and (
          (vl.scope = 'admin' and vl.class_id is null)
          or vl.owner_id = auth.uid()
          or vl.class_id in (select cm.class_id from public.class_members cm where cm.student_id = auth.uid())
        )
    )
  );

drop policy if exists "vocab_words_personal_write" on public.vocab_words;
create policy "vocab_words_personal_write" on public.vocab_words
  for all using (
    exists (select 1 from public.vocab_lists vl where vl.id = vocab_words.list_id and vl.owner_id = auth.uid() and vl.scope = 'personal')
  )
  with check (
    exists (select 1 from public.vocab_lists vl where vl.id = vocab_words.list_id and vl.owner_id = auth.uid() and vl.scope = 'personal')
  );

drop policy if exists "vocab_progress_student_own" on public.vocab_progress;
create policy "vocab_progress_student_own" on public.vocab_progress
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

grant select, insert, update, delete on public.vocab_lists to authenticated;
grant select, insert, update, delete on public.vocab_words to authenticated;
grant select, insert, update, delete on public.vocab_progress to authenticated;
