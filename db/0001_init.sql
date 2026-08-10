-- VMSA Deacon Tracker — initial schema
-- Run this against a fresh Supabase (Postgres) project via the SQL editor,
-- then run 0002_seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference lists
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  allows_multiple boolean not null default false,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------

create table deacons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  city text,
  email text,
  dob date,
  age_group_override text check (age_group_override in ('Child', 'Youth', 'Adult')),
  rank text not null default 'Epsaltos (Hymnist)' check (
    rank in (
      'Epsaltos (Hymnist)',
      'Ognostis (Reader)',
      'Epideacon (Subdeacon)',
      'Deacon (Full Deacon)',
      'Archdeacon'
    )
  ),
  -- Each element is either a locations.id (as text) or the literal 'All'.
  location_prefs text[] not null default '{}',
  -- Each element is one of S1/S2/Wed/Fri/Sat/Other or the literal 'All'.
  liturgy_prefs text[] not null default '{}',
  notes text, -- admin-only, never shown to the deacon themselves
  status text not null default 'Active' check (status in ('Active', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deacons_status_idx on deacons (status);
create index deacons_email_idx on deacons (email);

-- ---------------------------------------------------------------------------
-- Liturgies + participation
-- ---------------------------------------------------------------------------

create table liturgies (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  location_id uuid not null references locations (id),
  service_type text not null check (service_type in ('S1', 'S2', 'Wed', 'Fri', 'Sat', 'Other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, location_id, service_type)
);

create index liturgies_date_idx on liturgies (date);
create index liturgies_location_idx on liturgies (location_id);

create table participation (
  id uuid primary key default gen_random_uuid(),
  liturgy_id uuid not null references liturgies (id) on delete cascade,
  deacon_id uuid not null references deacons (id),
  activity_id uuid references activities (id),
  source text not null check (source in ('admin', 'self')),
  "timestamp" timestamptz not null default now()
);

-- At most one "attended, no specific activity" row per deacon per liturgy.
create unique index participation_attendance_unique
  on participation (liturgy_id, deacon_id)
  where activity_id is null;

-- No duplicate identical assignment rows. Single-slot activities (allows_multiple
-- = false) are kept to one deacon by application logic (replace-on-write), not
-- by a DB constraint, since allows_multiple is admin-editable data, not schema.
create unique index participation_assignment_unique
  on participation (liturgy_id, deacon_id, activity_id)
  where activity_id is not null;

create index participation_liturgy_idx on participation (liturgy_id);
create index participation_deacon_idx on participation (deacon_id);
create index participation_activity_idx on participation (activity_id);

-- ---------------------------------------------------------------------------
-- Passion Week (Holy Week) — structural services/hours/activities, not
-- drawn from the activities table.
-- ---------------------------------------------------------------------------

create table passion_week_participation (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  location_id uuid not null references locations (id),
  service_id text not null check (
    service_id in (
      'sun_eve', 'mon_morn', 'mon_eve', 'tue_morn', 'tue_eve',
      'wed_morn', 'wed_eve', 'thu_morn', 'thu_eve', 'good_fri'
    )
  ),
  hour text not null check (hour in ('1st', '3rd', '6th', '9th', '11th', '12th')),
  activity_id text not null check (activity_id in ('PC1', 'PC2', 'GC', 'GE')),
  slot_index int not null default 0,
  deacon_id uuid not null references deacons (id),
  "timestamp" timestamptz not null default now(),
  unique (year, location_id, service_id, hour, activity_id, slot_index)
);

create index pwp_year_location_idx on passion_week_participation (year, location_id);
create index pwp_deacon_idx on passion_week_participation (deacon_id);

-- ---------------------------------------------------------------------------
-- Users (who can sign in) — deliberately separate from deacons, see spec §6.1
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null check (role in ('SystemAdmin', 'GeneralAdmin', 'Deacon')),
  linked_deacon_id uuid references deacons (id),
  pin_hash text, -- null = PIN login not yet set up
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  -- The one seeded SystemAdmin account; can never be disabled or deleted.
  is_primary_admin boolean not null default false,
  last_record_location_id uuid references locations (id),
  last_checkin_location_id uuid references locations (id),
  last_report_location_id uuid references locations (id),
  created_at timestamptz not null default now()
);

create unique index users_one_primary_admin
  on users (is_primary_admin)
  where is_primary_admin;

create index users_linked_deacon_idx on users (linked_deacon_id);
create index users_role_idx on users (role);

-- ---------------------------------------------------------------------------
-- App-wide settings (key/value)
-- ---------------------------------------------------------------------------

create table app_settings (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- Archive tables — same shape as their live counterparts. Rows are moved
-- here (never deleted) by the Archive admin action; see spec §6.7.
-- ---------------------------------------------------------------------------

create table archive_liturgies (
  id uuid primary key,
  date date not null,
  location_id uuid not null references locations (id),
  service_type text not null check (service_type in ('S1', 'S2', 'Wed', 'Fri', 'Sat', 'Other')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (date, location_id, service_type)
);

create index archive_liturgies_date_idx on archive_liturgies (date);
create index archive_liturgies_location_idx on archive_liturgies (location_id);

create table archive_participation (
  id uuid primary key,
  liturgy_id uuid not null references archive_liturgies (id) on delete cascade,
  deacon_id uuid not null references deacons (id),
  activity_id uuid references activities (id),
  source text not null check (source in ('admin', 'self')),
  "timestamp" timestamptz not null
);

create index archive_participation_liturgy_idx on archive_participation (liturgy_id);
create index archive_participation_deacon_idx on archive_participation (deacon_id);

create table archive_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  cutoff_date date not null,
  liturgies_moved int not null,
  participation_moved int not null,
  by_user_email text not null
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deacons_set_updated_at
  before update on deacons
  for each row execute function set_updated_at();

create trigger liturgies_set_updated_at
  before update on liturgies
  for each row execute function set_updated_at();
