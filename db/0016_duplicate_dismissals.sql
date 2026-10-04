-- Pairs an admin has reviewed in "Detect Duplicates" and judged to be two
-- different people (e.g. family members sharing a phone or email), so the
-- detector stops listing them. Stored with deacon_a_id < deacon_b_id, the
-- same ordering the detector uses, so a pair has exactly one possible row.
--
-- ON DELETE CASCADE: if either record is later merged away or deleted, the
-- judgment about that specific record goes with it -- there's nothing left
-- to mis-flag.

create table duplicate_dismissals (
  deacon_a_id uuid not null references deacons (id) on delete cascade,
  deacon_b_id uuid not null references deacons (id) on delete cascade,
  dismissed_by_email text not null,
  dismissed_at timestamptz not null default now(),
  primary key (deacon_a_id, deacon_b_id),
  check (deacon_a_id < deacon_b_id)
);

create index duplicate_dismissals_b_idx on duplicate_dismissals (deacon_b_id);
