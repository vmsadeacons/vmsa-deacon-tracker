-- Feast names become a real admin-editable reference table (mirroring
-- Locations/Activities/Ranks), replacing free-text entry on Record a
-- Liturgy, so different admins can't enter different spellings for the same
-- feast -- and renaming one here retroactively relabels every liturgy that
-- used it, the same way renaming a rank or location already does.

create table feast_names (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now()
);

-- Seed with the feast names already in use, so existing recorded liturgies
-- have a matching row to link to below.
insert into feast_names (name, sort_order) values
  ('Nativity', 0),
  ('Epiphany', 1),
  ('Holy Thursday', 2),
  ('Transfiguration', 3);

alter table liturgies add column feast_name_id uuid references feast_names (id);
alter table archive_liturgies add column feast_name_id uuid references feast_names (id);

update liturgies l set feast_name_id = f.id from feast_names f where l.feast_name = f.name;
update archive_liturgies l set feast_name_id = f.id from feast_names f where l.feast_name = f.name;

alter table liturgies drop constraint liturgies_feast_name_check;
alter table liturgies add constraint liturgies_feast_name_check
  check (is_special_feast = false or feast_name_id is not null);

alter table archive_liturgies drop constraint archive_liturgies_feast_name_check;
alter table archive_liturgies add constraint archive_liturgies_feast_name_check
  check (is_special_feast = false or feast_name_id is not null);

alter table liturgies drop column feast_name;
alter table archive_liturgies drop column feast_name;
