-- Collapses service_type down to just an ordinal (S1 = 1st Liturgy,
-- S2 = 2nd Liturgy), day-of-week-agnostic, so any day can have up to two
-- liturgies -- not just Sunday. "Special Feast" becomes an orthogonal flag
-- + name on the liturgy itself (is_special_feast/feast_name), independent
-- of which ordinal it is or what day it falls on, since a feast can land on
-- any weekday and some feast days have two liturgies (both get the same
-- feast_name, distinguished by ordinal).

alter table liturgies add column is_special_feast boolean not null default false;
alter table liturgies add column feast_name text;
alter table liturgies add constraint liturgies_feast_name_check
  check (is_special_feast = false or (feast_name is not null and feast_name <> ''));

alter table archive_liturgies add column is_special_feast boolean not null default false;
alter table archive_liturgies add column feast_name text;
alter table archive_liturgies add constraint archive_liturgies_feast_name_check
  check (is_special_feast = false or (feast_name is not null and feast_name <> ''));

-- One-time reclassification of known feast liturgies (all currently
-- service_type = 'Feast' or, for today's Transfiguration, still tagged by
-- the weekday an admin picked before this change existed).
update liturgies set is_special_feast = true, feast_name = 'Nativity'
  where date = '2026-01-07' and service_type = 'Feast';
update liturgies set is_special_feast = true, feast_name = 'Epiphany'
  where date = '2026-01-19' and service_type = 'Feast';
update liturgies set is_special_feast = true, feast_name = 'Holy Thursday'
  where date = '2026-04-09' and service_type = 'Feast';
update liturgies set is_special_feast = true, feast_name = 'Transfiguration'
  where date = '2026-08-19';

-- Every remaining liturgy (Wed/Fri/Feast-coded, and any survivors of the
-- above) collapses to the 1st-liturgy ordinal -- no date+location in the
-- live data currently has more than one liturgy, so there's no genuine
-- 2nd-liturgy case to preserve; each existing row simply becomes "1st".
update liturgies set service_type = 'S1' where service_type in ('Wed', 'Fri', 'Feast', 'Other');
update archive_liturgies set service_type = 'S1' where service_type in ('Wed', 'Fri', 'Feast', 'Other');

alter table liturgies drop constraint liturgies_service_type_check;
alter table liturgies add constraint liturgies_service_type_check
  check (service_type in ('S1', 'S2'));

alter table archive_liturgies drop constraint archive_liturgies_service_type_check;
alter table archive_liturgies add constraint archive_liturgies_service_type_check
  check (service_type in ('S1', 'S2'));
