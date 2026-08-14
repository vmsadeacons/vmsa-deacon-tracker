import { query } from "@/lib/db";
import { computeAgeGroup } from "@/lib/ageGroup";
import { getAppSettings } from "@/lib/repo/settings";
import { passionWeekYearOverlapsRange } from "@/lib/timezone";
import { PW_SERVICES, PW_HOUR_WITH_12TH, type AgeGroup } from "@/lib/constants";

export interface DeaconHistoryRecord {
  date: string;
  serviceType: string;
  locationName: string;
  activityName: string | null; // null = plain attendance, no specific activity
}

export interface DeaconHistoryPW {
  year: number;
  serviceId: string;
  hour: string;
  activityId: string;
  locationName: string;
}

export interface DeaconHistory {
  stats: {
    liturgiesAttended: number;
    altarServices: number;
    readings: number;
    passionWeekReadings: number;
  };
  records: DeaconHistoryRecord[];
  passionWeek: DeaconHistoryPW[];
}

interface RawHistoryRow {
  date: string;
  service_type: string;
  location_name: string;
  activity_name: string | null;
  allows_multiple: boolean | null;
  liturgy_id: string;
  activity_sort_order: number | null;
}

/**
 * Merges live + archived liturgies/participation into one set of totals and
 * lists — a liturgy only ever exists in one of the two places at a time, so
 * this never double-counts. Used by both My History and Reports -> By
 * Deacon (spec §6.7, §7.9.2, §7.12).
 */
export async function getDeaconHistory(
  deaconId: string,
  fromDate: string | null,
  toDate: string | null
): Promise<DeaconHistory> {
  const { rows } = await query<RawHistoryRow>(
    `select l.date, l.service_type, loc.name as location_name, a.name as activity_name,
            a.allows_multiple, p.liturgy_id, a.sort_order as activity_sort_order
     from participation p
     join liturgies l on l.id = p.liturgy_id
     join locations loc on loc.id = l.location_id
     left join activities a on a.id = p.activity_id
     where p.deacon_id = $1
       and ($2::date is null or l.date >= $2)
       and ($3::date is null or l.date <= $3)
     union all
     select l.date, l.service_type, loc.name as location_name, a.name as activity_name,
            a.allows_multiple, p.liturgy_id, a.sort_order as activity_sort_order
     from archive_participation p
     join archive_liturgies l on l.id = p.liturgy_id
     join locations loc on loc.id = l.location_id
     left join activities a on a.id = p.activity_id
     where p.deacon_id = $1
       and ($2::date is null or l.date >= $2)
       and ($3::date is null or l.date <= $3)
     order by date desc, activity_sort_order nulls first`,
    [deaconId, fromDate, toDate]
  );

  const liturgyIds = new Set<string>();
  let altarServices = 0;
  let readings = 0;
  const records: DeaconHistoryRecord[] = rows.map((r) => {
    liturgyIds.add(r.liturgy_id);
    if (r.allows_multiple === true) altarServices += 1;
    if (r.allows_multiple === false) readings += 1;
    return {
      date: r.date,
      serviceType: r.service_type,
      locationName: r.location_name,
      activityName: r.activity_name,
    };
  });

  const { rows: rawPwRows } = await query<{
    year: number;
    service_id: string;
    hour: string;
    activity_id: string;
    location_name: string;
  }>(
    `select p.year, p.service_id, p.hour, p.activity_id, loc.name as location_name
     from passion_week_participation p
     join locations loc on loc.id = p.location_id
     where p.deacon_id = $1`,
    [deaconId]
  );
  const passionWeek: DeaconHistoryPW[] = rawPwRows
    .map((r) => ({
      year: r.year,
      serviceId: r.service_id,
      hour: r.hour,
      activityId: r.activity_id,
      locationName: r.location_name,
    }))
    .filter((r) => passionWeekYearOverlapsRange(r.year, fromDate, toDate))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const svcOrder =
        PW_SERVICES.findIndex((s) => s.id === a.serviceId) -
        PW_SERVICES.findIndex((s) => s.id === b.serviceId);
      if (svcOrder !== 0) return svcOrder;
      return PW_HOUR_WITH_12TH.indexOf(a.hour as never) - PW_HOUR_WITH_12TH.indexOf(b.hour as never);
    });

  return {
    stats: {
      liturgiesAttended: liturgyIds.size,
      altarServices,
      readings,
      passionWeekReadings: passionWeek.length,
    },
    records,
    passionWeek,
  };
}

export interface SummaryRow {
  deaconId: string;
  name: string;
  ageGroup: AgeGroup | null;
  attended: number;
  altar: number;
  readings: number;
}

/** One aggregated query, not a per-deacon loop — avoids the N+1 the original build had (spec §8.1). */
export async function getSummaryReport(
  fromDate: string | null,
  toDate: string | null,
  locationId: string | null,
  serviceType: string | null = null,
  includeGuests: boolean = false
): Promise<SummaryRow[]> {
  const settings = await getAppSettings();
  const { rows } = await query<{
    id: string;
    name: string;
    dob: string | null;
    age_group_override: AgeGroup | null;
    attended: string;
    altar: string;
    readings: string;
  }>(
    `with combined as (
       select p.deacon_id, p.liturgy_id, l.date, l.location_id, l.service_type, a.allows_multiple
       from participation p
       join liturgies l on l.id = p.liturgy_id
       left join activities a on a.id = p.activity_id
       where ($1::date is null or l.date >= $1)
         and ($2::date is null or l.date <= $2)
         and ($3::uuid is null or l.location_id = $3)
         and ($4::text is null or l.service_type = $4)
       union all
       select p.deacon_id, p.liturgy_id, l.date, l.location_id, l.service_type, a.allows_multiple
       from archive_participation p
       join archive_liturgies l on l.id = p.liturgy_id
       left join activities a on a.id = p.activity_id
       where ($1::date is null or l.date >= $1)
         and ($2::date is null or l.date <= $2)
         and ($3::uuid is null or l.location_id = $3)
         and ($4::text is null or l.service_type = $4)
     )
     select d.id, d.name, d.dob, d.age_group_override,
       count(distinct c.liturgy_id) as attended,
       count(*) filter (where c.allows_multiple = true) as altar,
       count(*) filter (where c.allows_multiple = false) as readings
     from deacons d
     left join combined c on c.deacon_id = d.id
     where d.status = 'Active' and ($5 or not d.is_guest)
     group by d.id
     order by d.name`,
    [fromDate, toDate, locationId, serviceType, includeGuests]
  );

  return rows.map((r) => ({
    deaconId: r.id,
    name: r.name,
    ageGroup: computeAgeGroup(
      r.dob,
      r.age_group_override,
      settings.ageGroupYouthMin,
      settings.ageGroupAdultMin
    ),
    attended: Number(r.attended),
    altar: Number(r.altar),
    readings: Number(r.readings),
  }));
}
