import { query } from "@/lib/db";
import { computeAgeGroup } from "@/lib/ageGroup";
import { getAppSettings } from "@/lib/repo/settings";
import { passionWeekYearOverlapsRange } from "@/lib/timezone";
import { PW_SERVICES, PW_HOUR_WITH_12TH, type AgeGroup } from "@/lib/constants";
import {
  COMBINED_VM_SA_ID,
  VIRGIN_MARY_LOCATION_NAME,
  ST_ATHANASIUS_LOCATION_NAME,
} from "@/lib/locationGroups";

export interface DeaconHistoryRecord {
  date: string;
  serviceType: string;
  isSpecialFeast: boolean;
  feastName: string | null;
  hasSibling: boolean;
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
  is_special_feast: boolean;
  feast_name: string | null;
  has_sibling: boolean;
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
    `select l.date, l.service_type, l.is_special_feast, fn.name as feast_name,
            exists(select 1 from liturgies l2 where l2.date = l.date and l2.location_id = l.location_id and l2.id <> l.id) as has_sibling,
            loc.name as location_name, a.name as activity_name,
            a.allows_multiple, p.liturgy_id, a.sort_order as activity_sort_order
     from participation p
     join liturgies l on l.id = p.liturgy_id
     join locations loc on loc.id = l.location_id
     left join activities a on a.id = p.activity_id
     left join feast_names fn on fn.id = l.feast_name_id
     where p.deacon_id = $1
       and ($2::date is null or l.date >= $2)
       and ($3::date is null or l.date <= $3)
     union all
     select l.date, l.service_type, l.is_special_feast, fn.name as feast_name,
            exists(select 1 from archive_liturgies l2 where l2.date = l.date and l2.location_id = l.location_id and l2.id <> l.id) as has_sibling,
            loc.name as location_name, a.name as activity_name,
            a.allows_multiple, p.liturgy_id, a.sort_order as activity_sort_order
     from archive_participation p
     join archive_liturgies l on l.id = p.liturgy_id
     join locations loc on loc.id = l.location_id
     left join activities a on a.id = p.activity_id
     left join feast_names fn on fn.id = l.feast_name_id
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
      isSpecialFeast: r.is_special_feast,
      feastName: r.feast_name,
      hasSibling: r.has_sibling,
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
  isGuest: boolean;
  attended: number;
  altar: number;
  readings: number;
}

export interface SummaryReport {
  rows: SummaryRow[];
  /** Earliest date among the matching (filtered) records — used to resolve an open "From" to a real date. */
  minDate: string | null;
}

// $6 (day filter mode: 'none' | 'weekdays' | 'specialFeast') and $7 (the
// weekday set for the 'weekdays' mode) let the Summary report restrict to a
// configurable day-of-week combination (see day_filter_options) -- 'none'
// applies no restriction, matching the pre-existing behavior. Guests are
// never excluded here -- that filter is applied client-side (like Age
// group), so toggling it doesn't need a fresh fetch. $3 is always an array
// (even for a single location) so it can also carry the combined "Virgin
// Mary + St Athanasius" pseudo-location's two real ids uniformly.
const SUMMARY_COMBINED_CTE = `
  with combined as (
    select p.deacon_id, p.liturgy_id, l.date, l.location_id, l.service_type, a.allows_multiple
    from participation p
    join liturgies l on l.id = p.liturgy_id
    left join activities a on a.id = p.activity_id
    where ($1::date is null or l.date >= $1)
      and ($2::date is null or l.date <= $2)
      and ($3::uuid[] is null or l.location_id = any($3::uuid[]))
      and ($4::text is null or l.service_type = $4)
      and (
        $6::text = 'none'
        or ($6 = 'specialFeast' and l.is_special_feast)
        or ($6 = 'weekdays' and extract(dow from l.date)::int = any($7::int[]))
      )
    union all
    select p.deacon_id, p.liturgy_id, l.date, l.location_id, l.service_type, a.allows_multiple
    from archive_participation p
    join archive_liturgies l on l.id = p.liturgy_id
    left join activities a on a.id = p.activity_id
    where ($1::date is null or l.date >= $1)
      and ($2::date is null or l.date <= $2)
      and ($3::uuid[] is null or l.location_id = any($3::uuid[]))
      and ($4::text is null or l.service_type = $4)
      and (
        $6::text = 'none'
        or ($6 = 'specialFeast' and l.is_special_feast)
        or ($6 = 'weekdays' and extract(dow from l.date)::int = any($7::int[]))
      )
  )
`;

/** One aggregated query, not a per-deacon loop — avoids the N+1 the original build had (spec §8.1). */
export async function getSummaryReport(
  fromDate: string | null,
  toDate: string | null,
  locationId: string | null,
  serviceType: string | null = null,
  rankId: string | null = null,
  dayFilterOptionId: string | null = null
): Promise<SummaryReport> {
  const settings = await getAppSettings();

  let dayFilterMode: "none" | "weekdays" | "specialFeast" = "none";
  let dayFilterWeekdays: number[] = [];
  if (dayFilterOptionId) {
    const { rows: dayFilterRows } = await query<{ weekdays: number[]; is_special_feast: boolean }>(
      `select weekdays, is_special_feast from day_filter_options where id = $1`,
      [dayFilterOptionId]
    );
    const option = dayFilterRows[0];
    if (option) {
      dayFilterMode = option.is_special_feast ? "specialFeast" : "weekdays";
      dayFilterWeekdays = option.weekdays;
    }
  }

  let locationIds: string[] | null = null;
  if (locationId === COMBINED_VM_SA_ID) {
    const { rows: combinedRows } = await query<{ id: string }>(
      `select id from locations where name in ($1, $2)`,
      [VIRGIN_MARY_LOCATION_NAME, ST_ATHANASIUS_LOCATION_NAME]
    );
    locationIds = combinedRows.map((r) => r.id);
  } else if (locationId) {
    locationIds = [locationId];
  }

  const params = [fromDate, toDate, locationIds, serviceType, rankId, dayFilterMode, dayFilterWeekdays];

  const { rows } = await query<{
    id: string;
    name: string;
    dob: string | null;
    age_group_override: AgeGroup | null;
    is_guest: boolean;
    attended: string;
    altar: string;
    readings: string;
  }>(
    `${SUMMARY_COMBINED_CTE}
     select d.id, d.name, d.dob, d.age_group_override, d.is_guest,
       count(distinct c.liturgy_id) as attended,
       count(*) filter (where c.allows_multiple = true) as altar,
       count(*) filter (where c.allows_multiple = false) as readings
     from deacons d
     left join combined c on c.deacon_id = d.id
     where d.status = 'Active' and ($5::uuid is null or d.rank_id = $5)
     group by d.id
     order by d.name`,
    params
  );

  // Earliest date among the exact same filtered set (location/service/rank/day),
  // so an open-ended "From" resolves to a real date rather than an approximation.
  const { rows: minDateRows } = await query<{ min_date: string | null }>(
    `${SUMMARY_COMBINED_CTE}
     select min(c.date) as min_date
     from combined c
     join deacons d on d.id = c.deacon_id
     where d.status = 'Active' and ($5::uuid is null or d.rank_id = $5)`,
    params
  );

  return {
    rows: rows.map((r) => ({
      deaconId: r.id,
      name: r.name,
      ageGroup: computeAgeGroup(
        r.dob,
        r.age_group_override,
        settings.ageGroupYouthMin,
        settings.ageGroupAdultMin
      ),
      isGuest: r.is_guest,
      attended: Number(r.attended),
      altar: Number(r.altar),
      readings: Number(r.readings),
    })),
    minDate: minDateRows[0]?.min_date ?? null,
  };
}
