-- Makes ranks a real admin-editable table (like locations/activities),
-- changes Date of Ordination to a plain Year, and adds Active/Inactive
-- status to Passion Week activities. Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Ranks table
-- ---------------------------------------------------------------------------

create table ranks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive'))
);

insert into ranks (name, sort_order) values
  ('Epsaltos (Hymnist)', 0),
  ('Ognostis (Reader)', 1),
  ('Epideacon (Subdeacon)', 2),
  ('Deacon (Full Deacon)', 3),
  ('Archdeacon', 4),
  ('Priest', 5);

alter table deacons add column rank_id uuid references ranks (id);

update deacons d set rank_id = r.id
from ranks r
where r.name = d.rank;

-- Fallback for any value that somehow didn't match (shouldn't happen).
update deacons set rank_id = (select id from ranks where name = 'Epsaltos (Hymnist)')
where rank_id is null;

alter table deacons alter column rank_id set not null;
-- No DB-level default (Postgres disallows a subquery in DEFAULT) --
-- createDeacon() resolves "Epsaltos (Hymnist)" to its id at the application layer instead.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'deacons'::regclass
    and pg_get_constraintdef(oid) like '%rank%' and contype = 'c';
  if con_name is not null then
    execute format('alter table deacons drop constraint %I', con_name);
  end if;
end $$;

alter table deacons drop column rank;
-- deacons.rank_id is now the FK; repo queries join ranks and alias the
-- readable name as `rank` for display, same pattern as `name`/`has_photo`.

-- ---------------------------------------------------------------------------
-- 2. Date of Ordination -> Year of Ordination
-- ---------------------------------------------------------------------------

alter table deacons add column ordination_year int;
update deacons set ordination_year = extract(year from date_of_ordination)::int
where date_of_ordination is not null;
alter table deacons drop column date_of_ordination;

-- ---------------------------------------------------------------------------
-- 3. Passion Week activities: Active/Inactive status
-- ---------------------------------------------------------------------------

alter table passion_week_activities add column status text not null default 'Active'
  check (status in ('Active', 'Inactive'));
