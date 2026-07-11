-- ================================================================
-- 004 - Classes and class-wide assignments
-- ================================================================

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  teacher_id uuid references public.profiles(id) on delete set null,
  join_code text unique not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

alter table public.test_assignments
  add column if not exists class_id uuid references public.classes(id) on delete cascade;

alter table public.test_assignments
  alter column student_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.test_assignments'::regclass
      and conname = 'test_assignments_target_check'
  ) then
    alter table public.test_assignments
      add constraint test_assignments_target_check
      check (student_id is not null or class_id is not null);
  end if;
end $$;

create unique index if not exists test_assignments_test_class_uidx
  on public.test_assignments(test_id, class_id)
  where class_id is not null;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

drop policy if exists "classes_admin_all" on public.classes;
drop policy if exists "classes_student_member_read" on public.classes;
create policy "classes_admin_all" on public.classes
  for all using (public.is_admin()) with check (public.is_admin());
create policy "classes_student_member_read" on public.classes
  for select using (
    exists (
      select 1
      from public.class_members cm
      where cm.class_id = classes.id
        and cm.student_id = auth.uid()
    )
  );

drop policy if exists "class_members_admin_all" on public.class_members;
drop policy if exists "class_members_student_read_own" on public.class_members;
create policy "class_members_admin_all" on public.class_members
  for all using (public.is_admin()) with check (public.is_admin());
create policy "class_members_student_read_own" on public.class_members
  for select using (student_id = auth.uid());

drop policy if exists "tests_students_assigned_published" on public.tests;
create policy "tests_students_assigned_published" on public.tests
  for select using (
    status = 'published'
    and exists (
      select 1
      from public.test_assignments ta
      where ta.test_id = tests.id
        and (
          ta.student_id = auth.uid()
          or ta.class_id in (
            select cm.class_id
            from public.class_members cm
            where cm.student_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "assignments_student_read" on public.test_assignments;
create policy "assignments_student_read" on public.test_assignments
  for select using (
    student_id = auth.uid()
    or class_id in (
      select cm.class_id
      from public.class_members cm
      where cm.student_id = auth.uid()
    )
  );

drop policy if exists "questions_students_assigned_published" on public.questions;
create policy "questions_students_assigned_published" on public.questions
  for select using (
    exists (
      select 1
      from public.tests t
      join public.test_assignments ta on ta.test_id = t.id
      where t.id = questions.test_id
        and t.status = 'published'
        and (
          ta.student_id = auth.uid()
          or ta.class_id in (
            select cm.class_id
            from public.class_members cm
            where cm.student_id = auth.uid()
          )
        )
    )
  );

create or replace view public.class_member_counts
as
select
  c.id as class_id,
  count(cm.student_id)::int as member_count
from public.classes c
left join public.class_members cm on cm.class_id = c.id
group by c.id;

create or replace function public.get_my_classes()
returns table (
  class_id uuid,
  name text,
  description text,
  teacher_name text,
  join_code text,
  member_count int,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    c.id,
    c.name,
    c.description,
    coalesce(t.full_name, 'Teacher') as teacher_name,
    c.join_code,
    count(all_members.student_id)::int as member_count,
    cm.joined_at
  from public.class_members cm
  join public.classes c on c.id = cm.class_id
  left join public.profiles t on t.id = c.teacher_id
  left join public.class_members all_members on all_members.class_id = c.id
  where cm.student_id = auth.uid()
    and c.is_archived = false
  group by c.id, c.name, c.description, t.full_name, c.join_code, cm.joined_at
  order by cm.joined_at desc;
end;
$$;

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;
grant select on public.class_member_counts to authenticated;
grant execute on function public.get_my_classes() to authenticated;
