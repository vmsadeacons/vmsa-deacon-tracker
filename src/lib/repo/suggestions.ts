import { query } from "@/lib/db";
import { monthsAgoISO } from "@/lib/timezone";

export interface SuggestionEntry {
  deaconId: string;
  percent: number;
}

interface CountRow {
  deacon_id: string;
  attended: string;
  altar_count: string;
  readings_count: string;
}

/**
 * For a given set of currently-attending deacons, ranks who's most overdue
 * for Altar Service and for Readings (lumping all allows_multiple = false
 * activities together, since "readings" is tracked as one combined concept
 * elsewhere in the app too -- e.g. Reports). Scored the same way as
 * Reports' percentage columns: that activity's count over liturgies
 * actually attended, across all locations, over a trailing window. Only
 * deacons who cleared the minimum-attendance bar are returned, so a
 * newcomer's small sample doesn't crowd out someone genuinely overdue;
 * capped to the 5 lowest percentages per activity type.
 */
export async function getServiceSuggestions(
  deaconIds: string[],
  windowMonths: number,
  minAttendance: number
): Promise<{ altar: SuggestionEntry[]; readings: SuggestionEntry[] }> {
  if (deaconIds.length === 0) return { altar: [], readings: [] };
  const cutoff = monthsAgoISO(windowMonths);

  const { rows } = await query<CountRow>(
    `select deacon_id,
       sum(attended) as attended,
       sum(altar_count) as altar_count,
       sum(readings_count) as readings_count
     from (
       select p.deacon_id,
         count(distinct p.liturgy_id) as attended,
         count(*) filter (where a.allows_multiple = true) as altar_count,
         count(*) filter (where a.allows_multiple = false) as readings_count
       from participation p
       join liturgies l on l.id = p.liturgy_id
       left join activities a on a.id = p.activity_id
       where p.deacon_id = any($1::uuid[]) and l.date >= $2
       group by p.deacon_id
       union all
       select p.deacon_id,
         count(distinct p.liturgy_id) as attended,
         count(*) filter (where a.allows_multiple = true) as altar_count,
         count(*) filter (where a.allows_multiple = false) as readings_count
       from archive_participation p
       join archive_liturgies l on l.id = p.liturgy_id
       left join activities a on a.id = p.activity_id
       where p.deacon_id = any($1::uuid[]) and l.date >= $2
       group by p.deacon_id
     ) combined
     group by deacon_id`,
    [deaconIds, cutoff]
  );

  const altar: SuggestionEntry[] = [];
  const readings: SuggestionEntry[] = [];
  for (const r of rows) {
    const attended = Number(r.attended);
    if (attended < minAttendance) continue;
    altar.push({ deaconId: r.deacon_id, percent: Number(r.altar_count) / attended });
    readings.push({ deaconId: r.deacon_id, percent: Number(r.readings_count) / attended });
  }

  altar.sort((a, b) => a.percent - b.percent);
  readings.sort((a, b) => a.percent - b.percent);

  return { altar: altar.slice(0, 5), readings: readings.slice(0, 5) };
}
