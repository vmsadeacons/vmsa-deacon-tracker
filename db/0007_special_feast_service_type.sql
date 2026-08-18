-- Splits the "Other / Special Liturgy" service type into two: "Feast"
-- (a named feast-day liturgy, e.g. Nativity/Epiphany, which can fall on any
-- weekday) and a plain "Other" catch-all. A feast is not detectable from
-- weekday alone (Palm Sunday/Easter are always Sundays; Christmas can fall
-- on any day), so it stays a manual admin choice -- computeDefaultServiceType
-- still defaults non-Sun/Wed/Fri/Sat dates to "Other".

alter table liturgies drop constraint liturgies_service_type_check;
alter table liturgies add constraint liturgies_service_type_check
  check (service_type in ('S1', 'S2', 'Wed', 'Fri', 'Sat', 'Feast', 'Other'));

alter table archive_liturgies drop constraint archive_liturgies_service_type_check;
alter table archive_liturgies add constraint archive_liturgies_service_type_check
  check (service_type in ('S1', 'S2', 'Wed', 'Fri', 'Sat', 'Feast', 'Other'));

-- One-time reclassification of the 3 known feast-day liturgies imported
-- from the 2026 spreadsheet load.
update liturgies set service_type = 'Feast'
where service_type = 'Other'
  and date in ('2026-01-07', '2026-01-19', '2026-04-09');
