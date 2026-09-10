-- deacon_merge_log is a pure audit trail -- it's displayed entirely from
-- its text snapshots (survivor_name / merged_name); the ids are never
-- shown or joined. A record that was the "kept" side of one merge can
-- later be deleted (merged into yet another record, or permanently
-- deleted once it has no history), and the strict NOT NULL + no-delete-
-- rule FK on survivor_id was blocking that -- the exact
-- "violates foreign key constraint deacon_merge_log_survivor_id_fkey"
-- error.
--
-- mergeDeacons() re-points these rows onto the new survivor itself (so the
-- merge-history chain stays intact); this SET NULL is the fallback for a
-- plain permanent delete, where there is no survivor to hand them to.

alter table deacon_merge_log alter column survivor_id drop not null;

alter table deacon_merge_log drop constraint deacon_merge_log_survivor_id_fkey;

alter table deacon_merge_log
  add constraint deacon_merge_log_survivor_id_fkey
  foreign key (survivor_id) references deacons (id) on delete set null;
