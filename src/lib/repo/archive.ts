import { query, withTransaction } from "@/lib/db";
import { monthsAgoISO } from "@/lib/timezone";

export type CutoffMonths = 1 | 6 | 12 | 36;

export function cutoffDateFor(months: CutoffMonths): string {
  return monthsAgoISO(months);
}

export interface ArchivePreview {
  cutoffDate: string;
  liturgiesToMove: number;
  participationToMove: number;
}

export async function previewArchive(months: CutoffMonths): Promise<ArchivePreview> {
  const cutoffDate = cutoffDateFor(months);
  const { rows } = await query<{ liturgies: string; participation: string }>(
    `select
       (select count(*) from liturgies where date < $1) as liturgies,
       (select count(*) from participation p join liturgies l on l.id = p.liturgy_id where l.date < $1) as participation`,
    [cutoffDate]
  );
  return {
    cutoffDate,
    liturgiesToMove: Number(rows[0].liturgies),
    participationToMove: Number(rows[0].participation),
  };
}

export interface ArchiveRunResult {
  cutoffDate: string;
  liturgiesMoved: number;
  participationMoved: number;
}

/** Always moves rows (never deletes); logs the run. Spec §6.7. */
export async function runArchive(
  months: CutoffMonths,
  byUserEmail: string
): Promise<ArchiveRunResult> {
  const cutoffDate = cutoffDateFor(months);

  return withTransaction(async (client) => {
    const { rows: liturgyRows } = await client.query<{ id: string }>(
      `select id from liturgies where date < $1`,
      [cutoffDate]
    );
    const liturgyIds = liturgyRows.map((r) => r.id);

    if (liturgyIds.length === 0) {
      await client.query(
        `insert into archive_log (cutoff_date, liturgies_moved, participation_moved, by_user_email)
         values ($1, 0, 0, $2)`,
        [cutoffDate, byUserEmail]
      );
      return { cutoffDate, liturgiesMoved: 0, participationMoved: 0 };
    }

    const { rowCount: participationMoved } = await client.query(
      `insert into archive_participation (id, liturgy_id, deacon_id, activity_id, source, "timestamp")
       select id, liturgy_id, deacon_id, activity_id, source, "timestamp"
       from participation
       where liturgy_id = any($1::uuid[])`,
      [liturgyIds]
    );
    await client.query(`delete from participation where liturgy_id = any($1::uuid[])`, [
      liturgyIds,
    ]);

    const { rowCount: liturgiesMoved } = await client.query(
      `insert into archive_liturgies (id, date, location_id, service_type, is_special_feast, feast_name_id, created_at, updated_at)
       select id, date, location_id, service_type, is_special_feast, feast_name_id, created_at, updated_at
       from liturgies
       where id = any($1::uuid[])`,
      [liturgyIds]
    );
    await client.query(`delete from liturgies where id = any($1::uuid[])`, [liturgyIds]);

    await client.query(
      `insert into archive_log (cutoff_date, liturgies_moved, participation_moved, by_user_email)
       values ($1, $2, $3, $4)`,
      [cutoffDate, liturgiesMoved, participationMoved, byUserEmail]
    );

    return { cutoffDate, liturgiesMoved: liturgiesMoved ?? 0, participationMoved: participationMoved ?? 0 };
  });
}

export interface ArchiveLogRow {
  id: string;
  run_at: string;
  cutoff_date: string;
  liturgies_moved: number;
  participation_moved: number;
  by_user_email: string;
}

export async function listArchiveRuns(): Promise<ArchiveLogRow[]> {
  const { rows } = await query<ArchiveLogRow>(
    `select * from archive_log order by run_at desc`
  );
  return rows;
}
