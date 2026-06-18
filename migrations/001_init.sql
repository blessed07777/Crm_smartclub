-- =============================================================
-- SmartClub CRM — initial schema for Railway Postgres
-- Pure Postgres: no Supabase auth, no RLS (app-layer auth via JWT)
-- =============================================================

create extension if not exists pgcrypto;

-- ----- USERS -----
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  full_name text not null default '',
  phone text,
  role text not null default 'manager' check (role in ('admin','manager','teacher')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_role_idx on users(role);

-- ----- SUBJECTS -----
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);

-- ----- LEADS -----
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  parent_name text,
  parent_phone text,
  grade smallint,
  target_subjects text[] default '{}',
  source text,
  status text not null default 'new' check (status in ('new','contacted','trial','negotiation','won','lost')),
  note text,
  assigned_to uuid references users(id) on delete set null,
  expected_revenue numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_assigned_idx on leads(assigned_to);

-- ----- STUDENTS -----
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  parent_name text,
  parent_phone text,
  grade smallint,
  school text,
  status text not null default 'active' check (status in ('active','frozen','archived','graduated')),
  target_score smallint,
  note text,
  enrolled_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_status_idx on students(status);

-- ----- GROUPS -----
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject_id uuid references subjects(id) on delete set null,
  teacher_id uuid references users(id) on delete set null,
  monthly_fee numeric(12,2) not null default 0,
  capacity smallint default 15,
  schedule_summary text,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists groups_teacher_idx on groups(teacher_id);

-- ----- GROUP STUDENTS -----
create table if not exists group_students (
  group_id uuid references groups(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  joined_at date not null default current_date,
  primary key (group_id, student_id)
);

-- ----- LESSONS -----
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  topic text,
  homework text,
  is_canceled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lessons_group_idx on lessons(group_id);
create index if not exists lessons_starts_idx on lessons(starts_at);

-- ----- ATTENDANCE -----
create table if not exists attendance (
  lesson_id uuid references lessons(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text not null default 'present' check (status in ('present','absent','late','excused')),
  score smallint,
  comment text,
  recorded_by uuid references users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

-- ----- PAYMENTS -----
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'income' check (kind in ('income','expense','payout','refund')),
  amount numeric(12,2) not null,
  currency text not null default 'KZT',
  student_id uuid references students(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  teacher_id uuid references users(id) on delete set null,
  category text,
  method text,
  description text,
  paid_at date not null default current_date,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_paid_idx on payments(paid_at);
create index if not exists payments_kind_idx on payments(kind);

-- ----- SEED SUBJECTS (idempotent) -----
insert into subjects (name, color) values
  ('Математика',               '#4f46e5'),
  ('Физика',                   '#06b6d4'),
  ('Химия',                    '#10b981'),
  ('Биология',                 '#22c55e'),
  ('История Казахстана',       '#f59e0b'),
  ('Грамотность чтения',       '#ef4444'),
  ('Математическая грамотность','#8b5cf6'),
  ('Английский язык',          '#0ea5e9'),
  ('Казахский язык',           '#14b8a6'),
  ('Русский язык',             '#f43f5e')
on conflict (name) do nothing;
