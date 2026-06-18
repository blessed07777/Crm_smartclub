-- =============================================================
-- Tasks & Plans for staff
-- task kind = 'task' (short-term todo) or 'plan' (KPI / goal)
-- =============================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'task' check (kind in ('task','plan')),
  status text not null default 'open' check (status in ('open','in_progress','done','canceled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  related_type text,
  related_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_assigned_idx on tasks(assigned_to);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_due_idx on tasks(due_at);
create index if not exists tasks_kind_idx on tasks(kind);

-- Auto-stamp completed_at when status flips to done
create or replace function tasks_touch_completed_at() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is null or old.status <> 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tasks_completed on tasks;
create trigger trg_tasks_completed
  before update on tasks
  for each row execute procedure tasks_touch_completed_at();
