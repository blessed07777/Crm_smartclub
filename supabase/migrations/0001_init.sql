-- ============================================================
-- SmartClub CRM — initial schema
-- Roles, students/leads, groups, lessons, attendance, finances
-- ============================================================

create extension if not exists "uuid-ossp";

-- --------- ENUMS -----------
do $$ begin
  create type user_role as enum ('admin', 'manager', 'teacher');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new', 'contacted', 'trial', 'negotiation', 'won', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type student_status as enum ('active', 'frozen', 'archived', 'graduated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_kind as enum ('income', 'expense', 'payout', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late', 'excused');
exception when duplicate_object then null; end $$;

-- --------- PROFILES (role-bearing user record) -----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role user_role not null default 'manager',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'manager')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: current role
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.current_role() = 'admin' $$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select public.current_role() in ('admin','manager') $$;

-- --------- SUBJECTS -----------
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);

-- --------- LEADS (sales funnel) -----------
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text not null,
  parent_name text,
  parent_phone text,
  grade smallint,
  target_subjects text[] default '{}',
  source text,
  status lead_status not null default 'new',
  note text,
  assigned_to uuid references public.profiles(id) on delete set null,
  expected_revenue numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_assigned_idx on public.leads(assigned_to);

-- --------- STUDENTS -----------
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  parent_name text,
  parent_phone text,
  grade smallint,
  school text,
  status student_status not null default 'active',
  target_score smallint,
  note text,
  enrolled_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_status_idx on public.students(status);

-- --------- GROUPS (classes / cohorts) -----------
create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.profiles(id) on delete set null,
  monthly_fee numeric(12,2) not null default 0,
  capacity smallint default 15,
  schedule_summary text,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists groups_teacher_idx on public.groups(teacher_id);

-- --------- GROUP ENROLLMENTS -----------
create table if not exists public.group_students (
  group_id uuid references public.groups(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  joined_at date not null default current_date,
  primary key (group_id, student_id)
);

-- --------- LESSONS (scheduled occurrences) -----------
create table if not exists public.lessons (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  topic text,
  homework text,
  is_canceled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lessons_group_idx on public.lessons(group_id);
create index if not exists lessons_starts_idx on public.lessons(starts_at);

-- --------- ATTENDANCE -----------
create table if not exists public.attendance (
  lesson_id uuid references public.lessons(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  status attendance_status not null default 'present',
  score smallint,
  comment text,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

-- --------- PAYMENTS / FINANCE -----------
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  kind payment_kind not null default 'income',
  amount numeric(12,2) not null,
  currency text not null default 'KZT',
  student_id uuid references public.students(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  teacher_id uuid references public.profiles(id) on delete set null,
  category text,
  method text,
  description text,
  paid_at date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_paid_idx on public.payments(paid_at);
create index if not exists payments_kind_idx on public.payments(kind);

-- --------- NOTES / ACTIVITY -----------
create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  subject_type text not null,           -- 'lead' | 'student' | 'group'
  subject_id uuid not null,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notes_subject_idx on public.notes(subject_type, subject_id);

-- --------- updated_at trigger -----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ begin
  create trigger trg_profiles_touch before update on public.profiles
    for each row execute procedure public.touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_leads_touch before update on public.leads
    for each row execute procedure public.touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_students_touch before update on public.students
    for each row execute procedure public.touch_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.subjects        enable row level security;
alter table public.leads           enable row level security;
alter table public.students        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_students  enable row level security;
alter table public.lessons         enable row level security;
alter table public.attendance      enable row level security;
alter table public.payments        enable row level security;
alter table public.notes           enable row level security;

-- PROFILES: each user sees their own; admin sees all
drop policy if exists "profiles_self_read"   on public.profiles;
drop policy if exists "profiles_admin_all"   on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_read"   on public.profiles for select using (auth.uid() = id or public.is_staff());
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy "profiles_admin_all"   on public.profiles for all    using (public.is_admin()) with check (public.is_admin());

-- SUBJECTS: read all; modify staff
drop policy if exists "subjects_read"   on public.subjects;
drop policy if exists "subjects_staff"  on public.subjects;
create policy "subjects_read"  on public.subjects for select using (auth.role() = 'authenticated');
create policy "subjects_staff" on public.subjects for all using (public.is_staff()) with check (public.is_staff());

-- LEADS: staff only
drop policy if exists "leads_staff" on public.leads;
create policy "leads_staff" on public.leads for all using (public.is_staff()) with check (public.is_staff());

-- STUDENTS: staff full; teachers read those in their groups
drop policy if exists "students_staff" on public.students;
drop policy if exists "students_teacher_read" on public.students;
create policy "students_staff" on public.students for all using (public.is_staff()) with check (public.is_staff());
create policy "students_teacher_read" on public.students for select using (
  exists (
    select 1 from public.group_students gs
    join public.groups g on g.id = gs.group_id
    where gs.student_id = students.id and g.teacher_id = auth.uid()
  )
);

-- GROUPS: staff full; teachers read their own
drop policy if exists "groups_staff" on public.groups;
drop policy if exists "groups_teacher_read" on public.groups;
create policy "groups_staff" on public.groups for all using (public.is_staff()) with check (public.is_staff());
create policy "groups_teacher_read" on public.groups for select using (teacher_id = auth.uid());

-- GROUP_STUDENTS: staff full; teacher read for own group
drop policy if exists "gs_staff" on public.group_students;
drop policy if exists "gs_teacher_read" on public.group_students;
create policy "gs_staff" on public.group_students for all using (public.is_staff()) with check (public.is_staff());
create policy "gs_teacher_read" on public.group_students for select using (
  exists (select 1 from public.groups g where g.id = group_students.group_id and g.teacher_id = auth.uid())
);

-- LESSONS: staff full; teacher read+write own group's lessons
drop policy if exists "lessons_staff" on public.lessons;
drop policy if exists "lessons_teacher_rw" on public.lessons;
create policy "lessons_staff" on public.lessons for all using (public.is_staff()) with check (public.is_staff());
create policy "lessons_teacher_rw" on public.lessons for all using (
  exists (select 1 from public.groups g where g.id = lessons.group_id and g.teacher_id = auth.uid())
) with check (
  exists (select 1 from public.groups g where g.id = lessons.group_id and g.teacher_id = auth.uid())
);

-- ATTENDANCE: staff full; teacher for own group
drop policy if exists "att_staff" on public.attendance;
drop policy if exists "att_teacher" on public.attendance;
create policy "att_staff" on public.attendance for all using (public.is_staff()) with check (public.is_staff());
create policy "att_teacher" on public.attendance for all using (
  exists (
    select 1 from public.lessons l join public.groups g on g.id = l.group_id
    where l.id = attendance.lesson_id and g.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.lessons l join public.groups g on g.id = l.group_id
    where l.id = attendance.lesson_id and g.teacher_id = auth.uid()
  )
);

-- PAYMENTS: staff only (teachers can see own payouts via separate view)
drop policy if exists "payments_staff" on public.payments;
drop policy if exists "payments_teacher_payout" on public.payments;
create policy "payments_staff" on public.payments for all using (public.is_staff()) with check (public.is_staff());
create policy "payments_teacher_payout" on public.payments for select using (
  kind = 'payout' and teacher_id = auth.uid()
);

-- NOTES: staff full; teacher own
drop policy if exists "notes_staff" on public.notes;
drop policy if exists "notes_teacher" on public.notes;
create policy "notes_staff" on public.notes for all using (public.is_staff()) with check (public.is_staff());
create policy "notes_teacher" on public.notes for all using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ============================================================
-- VIEWS for analytics
-- ============================================================
create or replace view public.v_finance_monthly as
select date_trunc('month', paid_at)::date as month,
       kind,
       sum(amount)::numeric(12,2) as total
from public.payments
group by 1, 2;

create or replace view public.v_student_balance as
select s.id as student_id,
       s.full_name,
       coalesce(sum(case when p.kind = 'income' then p.amount
                         when p.kind = 'refund' then -p.amount else 0 end), 0) as paid,
       coalesce(
         (select sum(g.monthly_fee) from public.group_students gs
          join public.groups g on g.id = gs.group_id
          where gs.student_id = s.id), 0) as monthly_charge
from public.students s
left join public.payments p on p.student_id = s.id
group by s.id, s.full_name;

-- ============================================================
-- SEED subjects
-- ============================================================
insert into public.subjects (name, color) values
  ('Математика',       '#4f46e5'),
  ('Физика',           '#06b6d4'),
  ('Химия',            '#10b981'),
  ('Биология',         '#22c55e'),
  ('История Казахстана','#f59e0b'),
  ('Грамотность чтения','#ef4444'),
  ('Математическая грамотность','#8b5cf6'),
  ('Английский язык',  '#0ea5e9'),
  ('Казахский язык',   '#14b8a6'),
  ('Русский язык',     '#f43f5e')
on conflict (name) do nothing;
