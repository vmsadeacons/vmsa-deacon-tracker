-- Adds an explicit display order to activities so Record a Liturgy's
-- Readings grid (and the Settings > Activities table) shows them in the
-- spec's fixed order instead of alphabetically. Run this once in the
-- Supabase SQL editor.

alter table activities add column sort_order int not null default 0;

update activities set sort_order = 0 where name = 'Altar service';
update activities set sort_order = 1 where name = 'Pauline Epistle';
update activities set sort_order = 2 where name = 'Catholic Epistle';
update activities set sort_order = 3 where name = 'Praxis (Acts)';
update activities set sort_order = 4 where name = 'Psalm & Gospel';

-- Any other existing activity (e.g. one you've added yourself) goes to the
-- end, ordered alphabetically among themselves.
update activities
set sort_order = sub.rn + 4
from (
  select id, row_number() over (order by name) as rn
  from activities
  where name not in ('Altar service', 'Pauline Epistle', 'Catholic Epistle', 'Praxis (Acts)', 'Psalm & Gospel')
) sub
where activities.id = sub.id;
