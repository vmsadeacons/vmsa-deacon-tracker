-- Check-in windows, round 1 follow-up.
--
--  * An extra liturgy now carries its own required start time, and may start
--    "the evening before" the day it counts for (e.g. Saturday 11:30 PM for
--    Sunday). Its 1st/2nd/3rd position is no longer stored: it is worked out
--    from the chronological order of the day's liturgies, so a liturgy that
--    starts the night before is naturally that day's 1st.
--  * How long before a liturgy check-in opens, and how long after it starts
--    it closes, become settings (they were fixed at 30 minutes / 3 hours).
--
-- Additive for the live app, which doesn't read extra_liturgies yet.

-- Dropping the column also drops the (location, date, service_type) unique
-- key and the service_type check that involved it.
alter table extra_liturgies drop column service_type;
update extra_liturgies set start_time = '12:00' where start_time is null;
alter table extra_liturgies alter column start_time set not null;
alter table extra_liturgies add column starts_evening_before boolean not null default false;
alter table extra_liturgies add constraint extra_liturgies_unique_start
  unique (location_id, date, starts_evening_before, start_time);

insert into app_settings (key, value) values
  ('checkin_open_before_minutes', '30'),
  ('checkin_close_after_minutes', '180')
on conflict (key) do nothing;
