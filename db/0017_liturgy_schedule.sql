-- Liturgy schedule, extra liturgies and check-in locking.
--
-- A day at a church now has a *schedule* (1 liturgy on weekdays, 2 on
-- Sundays, plus any admin-added extras), and Agios Check-in / the church QR
-- code check deacons into whichever single liturgy is "open" right now.
-- Everything here is additive: the live app ignores the new tables, and
-- widening the ordinal check only permits one more value.

-- A Sunday can have a 3rd liturgy (and a weekday can have extras up to a
-- 3rd). No 4th.
alter table liturgies drop constraint liturgies_service_type_check;
alter table liturgies add constraint liturgies_service_type_check
  check (service_type in ('S1', 'S2', 'S3'));

alter table archive_liturgies drop constraint archive_liturgies_service_type_check;
alter table archive_liturgies add constraint archive_liturgies_service_type_check
  check (service_type in ('S1', 'S2', 'S3'));

-- Start time of each liturgy ordinal, per church and weekday (0=Sun..6=Sat).
-- Replaces the old single "1st/2nd cutoff" per weekday. A church/weekday/
-- ordinal with no row falls back to a default in code until an admin sets it.
create table liturgy_start_times (
  location_id uuid not null references locations (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  service_type text not null check (service_type in ('S1', 'S2', 'S3')),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  primary key (location_id, weekday, service_type)
);

-- Liturgies added on top of the default schedule, one row per date (a
-- repeating series is expanded into one row per date, tied together by
-- series_id so the whole series can be removed in one go). start_time is an
-- optional override of that day's default start time for the ordinal.
create table extra_liturgies (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  date date not null,
  service_type text not null check (service_type in ('S1', 'S2', 'S3')),
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  series_id uuid,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (location_id, date, service_type)
);
create index extra_liturgies_date_idx on extra_liturgies (date);
create index extra_liturgies_series_idx on extra_liturgies (series_id);

-- An admin's manual open/close of one liturgy for check-in, on top of the
-- automatic window. Only meaningful for today's liturgies (keyed by date, so
-- yesterday's rows are inert and need no cleanup).
create table liturgy_lock_overrides (
  location_id uuid not null references locations (id) on delete cascade,
  date date not null,
  service_type text not null check (service_type in ('S1', 'S2', 'S3')),
  state text not null check (state in ('open', 'closed')),
  set_by uuid references users (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (location_id, date, service_type)
);

-- The schedule rule applies from this date onward; earlier dates keep the
-- old "any day may have a 1st and a 2nd" behaviour so history is untouched.
insert into app_settings (key, value) values ('schedule_start_date', '2026-10-24')
  on conflict (key) do nothing;
