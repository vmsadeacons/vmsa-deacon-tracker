-- Splits Name into First/Last/Qualifier, adds Guest/Photo/Date of
-- Ordination to deacons, adds "Priest" rank, adds the "Matins Gospel"
-- activity, and makes Passion Week activity labels/order editable.
-- Run once in the Supabase SQL editor (clear the editor first).

-- ---------------------------------------------------------------------------
-- 1. Split name into first_name / last_name / name_qualifier
-- ---------------------------------------------------------------------------

alter table deacons add column first_name text;
alter table deacons add column last_name text;
alter table deacons add column name_qualifier text;

update deacons set
  first_name = trim(split_part(trim(name), ' ', 1)),
  last_name = case
    when position(' ' in trim(name)) > 0
    then trim(substring(trim(name) from position(' ' in trim(name)) + 1))
    else ''
  end;

alter table deacons alter column first_name set not null;
alter table deacons alter column last_name set not null;
alter table deacons alter column last_name set default '';

alter table deacons drop column name;

alter table deacons add column name text generated always as (
  trim(first_name || ' ' || last_name) ||
  case when name_qualifier is not null and name_qualifier <> ''
       then ' (' || name_qualifier || ')'
       else ''
  end
) stored;

-- First + Last + Qualifier together identify a deacon; enforced case-insensitively.
create unique index deacons_identity_unique on deacons (
  lower(first_name), lower(last_name), lower(coalesce(name_qualifier, ''))
);

-- ---------------------------------------------------------------------------
-- 2. Guest, photo, date of ordination
-- ---------------------------------------------------------------------------

alter table deacons add column is_guest boolean not null default false;
alter table deacons add column photo bytea;
alter table deacons add column date_of_ordination date;

-- ---------------------------------------------------------------------------
-- 3. Add "Priest" to the rank list
-- ---------------------------------------------------------------------------

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'deacons'::regclass
    and pg_get_constraintdef(oid) like '%rank%';
  if con_name is not null then
    execute format('alter table deacons drop constraint %I', con_name);
  end if;
end $$;

alter table deacons add constraint deacons_rank_check check (
  rank in (
    'Epsaltos (Hymnist)',
    'Ognostis (Reader)',
    'Epideacon (Subdeacon)',
    'Deacon (Full Deacon)',
    'Archdeacon',
    'Priest'
  )
);

-- ---------------------------------------------------------------------------
-- 4. "Matins Gospel" activity, ahead of Pauline Epistle
-- ---------------------------------------------------------------------------

update activities set sort_order = sort_order + 1 where sort_order >= 1;
insert into activities (name, allows_multiple, status, sort_order)
values ('Matins Gospel', false, 'Active', 1);

-- ---------------------------------------------------------------------------
-- 5. Passion Week activities: name + order editable, set is fixed
-- ---------------------------------------------------------------------------

create table passion_week_activities (
  code text primary key check (code in ('PC1', 'PC2', 'GC', 'GE')),
  label text not null,
  sort_order int not null
);

insert into passion_week_activities (code, label, sort_order) values
  ('PC1', 'Psalm Coptic 1', 0),
  ('PC2', 'Psalm Coptic 2', 1),
  ('GC', 'Gospel Coptic', 2),
  ('GE', 'Gospel English', 3);
