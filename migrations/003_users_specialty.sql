-- =============================================================
-- Teacher profile: specialty (subject) + workplace
-- =============================================================

alter table users add column if not exists specialty text;
alter table users add column if not exists workplace text;

create index if not exists users_specialty_idx on users(specialty);
