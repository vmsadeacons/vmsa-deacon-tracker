-- Adds week-granularity options (1/2/3 weeks) to the Dashboard's "Absent"
-- alert period, alongside the existing month options (1/2/3/6 months).
-- Replaces the single absence_period_months setting with a value+unit
-- pair so both granularities can be represented exactly.

insert into app_settings (key, value)
select 'absence_period_value', value from app_settings where key = 'absence_period_months'
on conflict (key) do update set value = excluded.value;

insert into app_settings (key, value) values ('absence_period_unit', 'months')
on conflict (key) do nothing;

delete from app_settings where key = 'absence_period_months';
