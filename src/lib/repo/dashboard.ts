import { query } from "@/lib/db";
import { getAppSettings, type AbsencePeriodUnit } from "@/lib/repo/settings";
import { monthsAgoISO, daysAgoISO } from "@/lib/timezone";
import { computeAgeGroup } from "@/lib/ageGroup";
import type { AgeGroup } from "@/lib/constants";

export interface DeaconContact {
  id: string;
  name: string;
  first_name: string;
  phone: string | null;
  location_prefs: string[];
  liturgy_prefs: string[];
  rank: string;
  age_group: AgeGroup | null;
}

interface RawDeaconContact {
  id: string;
  name: string;
  first_name: string;
  phone: string | null;
  location_prefs: string[];
  liturgy_prefs: string[];
  rank: string;
  dob: string | null;
  age_group_override: AgeGroup | null;
}

export interface DashboardStats {
  activeDeaconsCount: number;
  activeDeacons: DeaconContact[];
  guestCount: number;
  absentCount: number;
  absentDeacons: DeaconContact[];
  absencePeriodValue: number;
  absencePeriodUnit: AbsencePeriodUnit;
}

const CONTACT_SELECT = `
  select d.id, d.name, d.first_name, d.phone, d.location_prefs, d.liturgy_prefs,
         r.name as rank, d.dob, d.age_group_override
  from deacons d
  left join ranks r on r.id = d.rank_id
`;

/** Both tiles exclude Archived deacons (spec §7.2) and Guests (visitors aren't regular roster). */
export async function getDashboardStats(): Promise<DashboardStats> {
  const settings = await getAppSettings();
  const cutoff =
    settings.absencePeriodUnit === "weeks"
      ? daysAgoISO(settings.absencePeriodValue * 7)
      : monthsAgoISO(settings.absencePeriodValue);

  const withAgeGroup = (d: RawDeaconContact): DeaconContact => ({
    id: d.id,
    name: d.name,
    first_name: d.first_name,
    phone: d.phone,
    location_prefs: d.location_prefs,
    liturgy_prefs: d.liturgy_prefs,
    rank: d.rank,
    age_group: computeAgeGroup(d.dob, d.age_group_override, settings.ageGroupYouthMin, settings.ageGroupAdultMin),
  });

  const { rows: activeRaw } = await query<RawDeaconContact>(
    `${CONTACT_SELECT} where d.status = 'Active' and not d.is_guest order by d.name`
  );

  const { rows: guestRows } = await query<{ count: string }>(
    `select count(*) from deacons where status = 'Active' and is_guest`
  );

  const { rows: absentRaw } = await query<RawDeaconContact>(
    `${CONTACT_SELECT}
     where d.status = 'Active'
       and not d.is_guest
       and not exists (
         select 1 from participation p join liturgies l on l.id = p.liturgy_id
         where p.deacon_id = d.id and l.date >= $1
       )
       and not exists (
         select 1 from archive_participation p join archive_liturgies l on l.id = p.liturgy_id
         where p.deacon_id = d.id and l.date >= $1
       )
     order by d.name`,
    [cutoff]
  );

  return {
    activeDeaconsCount: activeRaw.length,
    activeDeacons: activeRaw.map(withAgeGroup),
    guestCount: Number(guestRows[0].count),
    absentCount: absentRaw.length,
    absentDeacons: absentRaw.map(withAgeGroup),
    absencePeriodValue: settings.absencePeriodValue,
    absencePeriodUnit: settings.absencePeriodUnit,
  };
}
