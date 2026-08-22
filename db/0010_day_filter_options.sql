-- Configurable "day of week" filter options for Reports -> Summary, so
-- admins can add/remove weekday combinations (e.g. "Mondays & Tuesdays")
-- without a code change. Not referenced by any liturgy/participation row,
-- so deleting one is always safe -- unlike Locations/Ranks/Feast Names,
-- there's no history to preserve, so these support real deletion instead
-- of an Active/Inactive toggle.

create table day_filter_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  weekdays int[] not null default '{}', -- 0=Sun..6=Sat; empty when is_special_feast
  is_special_feast boolean not null default false,
  sort_order int not null default 0
);

insert into day_filter_options (label, weekdays, is_special_feast, sort_order) values
  ('Sundays', '{0}', false, 0),
  ('Mondays', '{1}', false, 1),
  ('Tuesdays', '{2}', false, 2),
  ('Wednesdays', '{3}', false, 3),
  ('Thursdays', '{4}', false, 4),
  ('Fridays', '{5}', false, 5),
  ('Saturdays', '{6}', false, 6),
  ('Mondays & Tuesdays', '{1,2}', false, 7),
  ('Wednesdays & Fridays', '{3,5}', false, 8),
  ('Special Feasts', '{}', true, 9);
