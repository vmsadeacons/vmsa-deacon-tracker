-- Round 2: flagged check-ins, the admin review list, phone alerts, and
-- per-church QR codes.
--
--  * locations.qr_token: the secret in each church's QR code. Regenerating it
--    (a new random value) makes every old printout or photo stop working.
--  * checkin_flags: one row per self check-in the server couldn't verify
--    (church picked by hand without a location fix, no location, far from the
--    church, or a church with no map location set). Admins confirm or reject
--    each one; rejecting removes the attendance but keeps this row as a log.
--  * flag_recipients: which admins are alerted about flags from which church.
--  * push_subscriptions: the phones/computers an admin has turned alerts on for.
--
-- Additive for the live app, which doesn't read any of these.

alter table locations add column qr_token text;
update locations set qr_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 24) where qr_token is null;
alter table locations alter column qr_token set not null;
alter table locations alter column qr_token set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
alter table locations add constraint locations_qr_token_unique unique (qr_token);

create table checkin_flags (
  id uuid primary key default gen_random_uuid(),
  deacon_id uuid not null references deacons (id) on delete cascade,
  location_id uuid not null references locations (id),
  -- Set null when the liturgy is archived; date + service_type keep the row readable.
  liturgy_id uuid references liturgies (id) on delete set null,
  date date not null,
  service_type text not null,
  method text not null check (method in ('agios', 'qr')),
  -- How the church was chosen: 'detected' (by GPS), 'selected' (by hand), 'qr' (the code).
  selection text not null check (selection in ('detected', 'selected', 'qr')),
  reason text not null check (reason in ('no_location', 'far_away', 'church_not_mapped')),
  distance_ft integer,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_by uuid references users (id) on delete set null,
  resolved_at timestamptz
);

create index checkin_flags_status_idx on checkin_flags (status, created_at desc);
create index checkin_flags_deacon_idx on checkin_flags (deacon_id, created_at desc);
-- A deacon scanning twice for the same liturgy shouldn't raise two open flags.
create unique index checkin_flags_one_pending
  on checkin_flags (deacon_id, liturgy_id)
  where status = 'pending' and liturgy_id is not null;

create table flag_recipients (
  location_id uuid not null references locations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  primary key (location_id, user_id)
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);
