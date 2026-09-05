-- Supports "Quick Check-in": a public, no-login form that uses geolocation
-- to confirm a deacon is physically at the church, and a configurable
-- per-location/per-weekday time cutoff (with a Special Feast override) to
-- predict 1st vs 2nd liturgy -- generalizing the Sunday-only 9am split that
-- previously lived only in computeDefaultServiceType.

alter table locations add column latitude double precision;
alter table locations add column longitude double precision;
alter table locations add column geofence_radius_ft integer;

-- weekday: 0=Sun..6=Sat, 7=Special Feast override (applies regardless of
-- weekday, since a feast can fall on any day -- same orthogonal-flag design
-- as is_special_feast itself). Only one row per (location, weekday); a
-- location/weekday with no row falls back to a default cutoff in code.
create table liturgy_time_cutoffs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  weekday int not null check (weekday between 0 and 7),
  cutoff_time text not null, -- "HH:MM", 24-hour, church-local time
  unique (location_id, weekday)
);

-- Preserves the existing Sunday 9am split for every currently-active
-- location, so nothing regresses; every other day/feast starts out on the
-- generic default (see predictServiceType) until an admin configures it.
insert into liturgy_time_cutoffs (location_id, weekday, cutoff_time)
  select id, 0, '09:00' from locations where status = 'Active';
