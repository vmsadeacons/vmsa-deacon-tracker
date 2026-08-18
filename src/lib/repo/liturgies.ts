import { query, withTransaction } from "@/lib/db";
import type { ServiceTypeCode } from "@/lib/constants";

/**
 * Live-editing only, on purpose (spec §6.7): finds-or-creates a row in the
 * live `liturgies` table via a real DB unique constraint (date, location,
 * service_type) — an atomic upsert, so concurrent clicks can never create a
 * duplicate liturgy the way the original spreadsheet build repeatedly did.
 * Never falls back to the archive; a match here is about to be written to.
 *
 * Only ever called from the write paths below (toggleAttendance and
 * friends), never just from viewing a date/location/service combo --
 * otherwise merely opening Record a Liturgy or Check-in for a day nobody
 * actually attended would leave a permanent, empty liturgy row behind
 * (visible on the Dashboard as if something happened). See
 * findLiturgyContext for the read-only lookup used by page loads.
 */
export async function getOrCreateLiturgy(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into liturgies (date, location_id, service_type)
     values ($1, $2, $3)
     on conflict (date, location_id, service_type) do update set updated_at = now()
     returning id`,
    [date, locationId, serviceType]
  );
  return rows[0].id;
}

export interface LiturgyParticipantRow {
  deacon_id: string;
  deacon_name: string;
  deacon_status: "Active" | "Archived";
  activity_id: string | null;
  activity_name: string | null;
  allows_multiple: boolean | null;
  activity_sort_order: number | null;
}

export interface LiturgyContext {
  liturgyId: string;
  attendeeIds: string[];
  attendees: { deaconId: string; name: string; status: string }[];
  assignments: {
    activityId: string;
    activityName: string;
    allowsMultiple: boolean;
    deaconIds: string[];
  }[];
}

async function buildLiturgyContext(
  liturgyId: string,
  archived: boolean
): Promise<LiturgyContext> {
  const participationTable = archived ? "archive_participation" : "participation";
  const { rows } = await query<LiturgyParticipantRow>(
    `select p.deacon_id, d.name as deacon_name, d.status as deacon_status,
            p.activity_id, a.name as activity_name, a.allows_multiple, a.sort_order as activity_sort_order
     from ${participationTable} p
     join deacons d on d.id = p.deacon_id
     left join activities a on a.id = p.activity_id
     where p.liturgy_id = $1
     order by d.name`,
    [liturgyId]
  );

  const attendeeMap = new Map<string, { deaconId: string; name: string; status: string }>();
  const assignmentMap = new Map<
    string,
    { activityId: string; activityName: string; allowsMultiple: boolean; sortOrder: number; deaconIds: string[] }
  >();

  for (const row of rows) {
    if (!attendeeMap.has(row.deacon_id)) {
      attendeeMap.set(row.deacon_id, {
        deaconId: row.deacon_id,
        name: row.deacon_name,
        status: row.deacon_status,
      });
    }
    if (row.activity_id) {
      let entry = assignmentMap.get(row.activity_id);
      if (!entry) {
        entry = {
          activityId: row.activity_id,
          activityName: row.activity_name!,
          allowsMultiple: row.allows_multiple!,
          sortOrder: row.activity_sort_order ?? 999,
          deaconIds: [],
        };
        assignmentMap.set(row.activity_id, entry);
      }
      entry.deaconIds.push(row.deacon_id);
    }
  }

  // Fixed activity order (spec §5): Altar service, Pauline, Catholic, Praxis, Psalm & Gospel.
  const assignments = [...assignmentMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    liturgyId,
    attendeeIds: [...attendeeMap.keys()],
    attendees: [...attendeeMap.values()],
    assignments: assignments.map((a) => ({
      activityId: a.activityId,
      activityName: a.activityName,
      allowsMultiple: a.allowsMultiple,
      deaconIds: a.deaconIds,
    })),
  };
}

/** Live-only — Record a Liturgy / Check-in must never read from the archive (spec §6.7). */
export async function getLiturgyContext(liturgyId: string): Promise<LiturgyContext> {
  return buildLiturgyContext(liturgyId, false);
}

function emptyLiturgyContext(): LiturgyContext {
  return { liturgyId: "", attendeeIds: [], attendees: [], assignments: [] };
}

/**
 * Read-only counterpart to getOrCreateLiturgy, for page loads and
 * date/location/service changes -- never creates a row. If nothing has
 * been recorded yet, returns liturgyId: null with an empty context.
 */
export async function findLiturgyContext(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode
): Promise<{ liturgyId: string | null; context: LiturgyContext }> {
  const { rows } = await query<{ id: string }>(
    `select id from liturgies where date = $1 and location_id = $2 and service_type = $3`,
    [date, locationId, serviceType]
  );
  if (!rows[0]) return { liturgyId: null, context: emptyLiturgyContext() };
  return { liturgyId: rows[0].id, context: await buildLiturgyContext(rows[0].id, false) };
}

/** Read-only report path: falls back to archive, flags it. Spec §7.9.1 / §6.7. */
export async function getLiturgyReportContext(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode
): Promise<(LiturgyContext & { archived: boolean }) | null> {
  const live = await query<{ id: string }>(
    `select id from liturgies where date = $1 and location_id = $2 and service_type = $3`,
    [date, locationId, serviceType]
  );
  if (live.rows[0]) {
    const ctx = await buildLiturgyContext(live.rows[0].id, false);
    return { ...ctx, archived: false };
  }
  const archived = await query<{ id: string }>(
    `select id from archive_liturgies where date = $1 and location_id = $2 and service_type = $3`,
    [date, locationId, serviceType]
  );
  if (archived.rows[0]) {
    const ctx = await buildLiturgyContext(archived.rows[0].id, true);
    return { ...ctx, archived: true };
  }
  return null;
}

/** Creates the liturgy row on first use (see getOrCreateLiturgy), then toggles plain attendance. */
export async function toggleAttendance(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  deaconId: string,
  source: "admin" | "self"
): Promise<LiturgyContext> {
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select id from participation where liturgy_id = $1 and deacon_id = $2 and activity_id is null`,
      [liturgyId, deaconId]
    );
    if (rows[0]) {
      await client.query(`delete from participation where id = $1`, [rows[0].id]);
    } else {
      await client.query(
        `insert into participation (liturgy_id, deacon_id, activity_id, source) values ($1, $2, null, $3)`,
        [liturgyId, deaconId, source]
      );
    }
  });
  return getLiturgyContext(liturgyId);
}

/** Idempotent: does nothing if the deacon is already marked attending by any means. */
export async function checkInSelf(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  deaconId: string
): Promise<LiturgyContext> {
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await query(
    `insert into participation (liturgy_id, deacon_id, activity_id, source)
     values ($1, $2, null, 'self')
     on conflict (liturgy_id, deacon_id) where activity_id is null do nothing`,
    [liturgyId, deaconId]
  );
  return getLiturgyContext(liturgyId);
}

/**
 * Only ever removes the plain attendance marker, and only one the deacon
 * set themselves. Read-only lookup -- if nothing was ever recorded for
 * this date/location/service, there's nothing to undo.
 */
export async function undoCheckInSelf(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  deaconId: string
): Promise<LiturgyContext> {
  const { rows } = await query<{ id: string }>(
    `select id from liturgies where date = $1 and location_id = $2 and service_type = $3`,
    [date, locationId, serviceType]
  );
  if (!rows[0]) return emptyLiturgyContext();
  const liturgyId = rows[0].id;
  await query(
    `delete from participation
     where liturgy_id = $1 and deacon_id = $2 and activity_id is null and source = 'self'`,
    [liturgyId, deaconId]
  );
  return getLiturgyContext(liturgyId);
}

/** Multi-select chip toggle, for allows_multiple activities (e.g. Altar service). */
export async function toggleMultiActivityAssignment(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  activityId: string,
  deaconId: string,
  source: "admin" | "self"
): Promise<LiturgyContext> {
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select id from participation where liturgy_id = $1 and activity_id = $2 and deacon_id = $3`,
      [liturgyId, activityId, deaconId]
    );
    if (rows[0]) {
      await client.query(`delete from participation where id = $1`, [rows[0].id]);
    } else {
      await client.query(
        `insert into participation (liturgy_id, deacon_id, activity_id, source) values ($1, $2, $3, $4)`,
        [liturgyId, deaconId, activityId, source]
      );
    }
  });
  return getLiturgyContext(liturgyId);
}

/** Single-deacon dropdown, for allows_multiple = false activities: replaces whoever held the slot. */
export async function setSingleActivityAssignment(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  activityId: string,
  deaconId: string | null,
  source: "admin" | "self"
): Promise<LiturgyContext> {
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await withTransaction(async (client) => {
    await client.query(`delete from participation where liturgy_id = $1 and activity_id = $2`, [
      liturgyId,
      activityId,
    ]);
    if (deaconId) {
      await client.query(
        `insert into participation (liturgy_id, deacon_id, activity_id, source) values ($1, $2, $3, $4)`,
        [liturgyId, deaconId, activityId, source]
      );
    }
  });
  return getLiturgyContext(liturgyId);
}

export interface RecentLiturgyRow {
  locationId: string;
  locationName: string;
  date: string | null;
  serviceType: string | null;
  attendeeCount: number;
  altarCount: number;
  readingsFilled: number;
  readingsTotal: number;
}

/** Dashboard's "recent activity by location" — merges live + archived, per spec §7.2. */
export async function getRecentLiturgiesByLocation(): Promise<RecentLiturgyRow[]> {
  const { rows: locations } = await query<{ id: string; name: string }>(
    `select id, name from locations where status = 'Active' order by name`
  );
  const { rows: readingActivities } = await query<{ id: string }>(
    `select id from activities where allows_multiple = false and status = 'Active'`
  );
  const readingsTotal = readingActivities.length;

  const results: RecentLiturgyRow[] = [];
  for (const loc of locations) {
    const { rows: candidates } = await query<{
      id: string;
      date: string;
      service_type: string;
      archived: boolean;
    }>(
      `select id, date, service_type, false as archived from liturgies where location_id = $1
       union all
       select id, date, service_type, true as archived from archive_liturgies where location_id = $1
       order by date desc
       limit 1`,
      [loc.id]
    );
    const winner = candidates[0];
    if (!winner) {
      results.push({
        locationId: loc.id,
        locationName: loc.name,
        date: null,
        serviceType: null,
        attendeeCount: 0,
        altarCount: 0,
        readingsFilled: 0,
        readingsTotal,
      });
      continue;
    }
    const participationTable = winner.archived ? "archive_participation" : "participation";
    const { rows: statRows } = await query<{
      attendee_count: string;
      altar_count: string;
      readings_filled: string;
    }>(
      `select
         count(distinct p.deacon_id) as attendee_count,
         count(*) filter (where a.allows_multiple = true) as altar_count,
         count(distinct a.id) filter (where a.allows_multiple = false) as readings_filled
       from ${participationTable} p
       left join activities a on a.id = p.activity_id
       where p.liturgy_id = $1`,
      [winner.id]
    );
    const stat = statRows[0];
    results.push({
      locationId: loc.id,
      locationName: loc.name,
      date: winner.date,
      serviceType: winner.service_type,
      attendeeCount: Number(stat.attendee_count),
      altarCount: Number(stat.altar_count),
      readingsFilled: Number(stat.readings_filled),
      readingsTotal,
    });
  }
  return results;
}
