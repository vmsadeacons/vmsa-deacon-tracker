-- Audit trail for the "Merge duplicate records" Settings tool. The merged
-- (deleted) deacon's own row is gone once a merge completes, so this
-- snapshot is the only place its id/name survive.

create table deacon_merge_log (
  id uuid primary key default gen_random_uuid(),
  survivor_id uuid not null references deacons (id),
  survivor_name text not null,
  merged_id uuid not null,
  merged_name text not null,
  participation_moved int not null default 0,
  passion_week_moved int not null default 0,
  user_relinked boolean not null default false,
  merged_at timestamptz not null default now(),
  merged_by_email text not null
);

create index deacon_merge_log_survivor_idx on deacon_merge_log (survivor_id);
