-- Supports the public, no-login self-service profile form:
-- pg_trgm powers the fuzzy first+last name search used to help a deacon
-- find their own existing record; profile_update_log tracks every
-- submission (created vs. updated) for the admin-facing "Member Updates"
-- review page. Not a full field-level audit trail -- just who submitted,
-- what kind of change, and when.

create extension if not exists pg_trgm;

create table profile_update_log (
  id uuid primary key default gen_random_uuid(),
  deacon_id uuid not null references deacons (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  submitted_at timestamptz not null default now()
);
