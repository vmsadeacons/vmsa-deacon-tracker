-- Supports the reworked public self-service form: the form no longer
-- pre-fills or reveals any existing record's data (that was the actual
-- privacy complaint -- picking a name showed that person's phone/email/
-- address). Instead the deacon re-enters everything blank; fields that
-- conflict with what's already on file are held here as a pending request
-- for an admin to approve or reject from Member Updates, rather than
-- silently overwriting (or silently revealing) another person's record.

create table profile_override_requests (
  id uuid primary key default gen_random_uuid(),
  deacon_id uuid not null references deacons (id) on delete cascade,
  field text not null,               -- machine key, e.g. 'phone', 'rankId'
  field_label text not null,         -- display label, e.g. "Phone"
  current_display text,              -- current value, human-readable -- admin-only, never sent to the public form
  requested_display text,            -- requested value, human-readable -- admin-only
  requested_value_json text not null, -- JSON-encoded raw value, applied verbatim on approval
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
