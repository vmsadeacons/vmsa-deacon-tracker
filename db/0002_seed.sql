-- VMSA Deacon Tracker — seed data. Run after 0001_init.sql.
-- Edit the SystemAdmin email/name below before running if this is being
-- set up for someone other than the original deploying admin.

insert into locations (name, status) values
  ('The Church of Virgin Mary', 'Active'),
  ('The Church of St. Athanasius', 'Active'),
  ('Nativity Church', 'Active'),
  ('Church of the Resurrection', 'Active'),
  ('The Valley of the Mother of God', 'Active');

insert into activities (name, allows_multiple, status, sort_order) values
  ('Altar service', true, 'Active', 0),
  ('Matins Gospel', false, 'Active', 1),
  ('Pauline Epistle', false, 'Active', 2),
  ('Catholic Epistle', false, 'Active', 3),
  ('Praxis (Acts)', false, 'Active', 4),
  ('Psalm & Gospel', false, 'Active', 5);

insert into passion_week_activities (code, label, sort_order) values
  ('PC1', 'Psalm Coptic 1', 0),
  ('PC2', 'Psalm Coptic 2', 1),
  ('GC', 'Gospel Coptic', 2),
  ('GE', 'Gospel English', 3);

insert into app_settings (key, value) values
  ('absence_period_months', '1'),
  ('age_group_youth_min', '18'),
  ('age_group_adult_min', '35');

insert into users (email, name, role, status, is_primary_admin) values
  ('magpsaad@gmail.com', 'Maged Saad', 'SystemAdmin', 'Active', true);
