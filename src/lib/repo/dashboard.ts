import { query } from "@/lib/db";
import { getAppSettings } from "@/lib/repo/settings";
import { monthsAgoISO, daysAgoISO } from "@/lib/timezone";
import { computeAgeGroup } from "@/lib/ageGroup";
import type { AgeGroup } from "@/lib/constants";

export type AbsencePeriodUnit = "weeks" | "months";

// The Dashboard's "Absent" period is a personal view filter (see
// DashboardStatTiles), not a persisted admin setting -- these are just the
// starting values shown before anyone touches the dropdown.
export const DEFAULT_ABSENCE_VALUE = 1;
export const DEFAULT_ABSENCE_UNIT: AbsencePeriodUnit = "months";

const ALLOWED_WEEK_VALUES = [1, 2, 3];
const ALLOWED_MONTH_VALUES = [1, 2, 3, 6];

export function isValidAbsencePeriod(value: number, unit: AbsencePeriodUnit): boolean {
  const allowed = unit === "weeks" ? ALLOWED_WEEK_VALUES : ALLOWED_MONTH_VALUES;
  return allowed.includes(value);
}

export interface DeaconContact {
  id: string;
  name: string;
  first_name: string;
  phone: string | null;
  email: string | null;
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
  email: string | null;
  location_prefs: string[];
  liturgy_prefs: string[];
  rank: string;
  dob: string | null;
  age_group_override: AgeGroup | null;
}

// Counts only. The contact lists behind each tile are fetched on demand
// (getActiveDeaconContacts / getAbsentDeaconsForPeriod) when a tile is
// clicked, so opening the Dashboard doesn't ship every deacon's contact
// details to the browser.
export interface DashboardStats {
  activeDeaconsCount: number;
  guestCount: number;
  absentCount: number;
  absencePeriodValue: number;
  absencePeriodUnit: AbsencePeriodUnit;
  missingPhoneCount: number;
  missingEmailCount: number;
}

const CONTACT_SELECT = `
  select d.id, d.name, d.first_name, d.phone, d.email, d.location_prefs, d.liturgy_prefs,
         r.name as rank, d.dob, d.age_group_override
  from deacons d
  left join ranks r on r.id = d.rank_id
`;

// A deacon is "absent" when they have no participation (live or archived)
// on or after the cutoff date. $1 is the cutoff.
const ABSENT_PREDICATE = `
  not exists (
    select 1 from participation p join liturgies l on l.id = p.liturgy_id
    where p.deacon_id = d.id and l.date >= $1
  )
  and not exists (
    select 1 from archive_participation p join archive_liturgies l on l.id = p.liturgy_id
    where p.deacon_id = d.id and l.date >= $1
  )`;

function absenceCutoff(value: number, unit: AbsencePeriodUnit): string {
  return unit === "weeks" ? daysAgoISO(value * 7) : monthsAgoISO(value);
}

async function getAbsentContacts(
  value: number,
  unit: AbsencePeriodUnit,
  ageGroupYouthMin: number,
  ageGroupAdultMin: number
): Promise<{ absentCount: number; absentDeacons: DeaconContact[] }> {
  const cutoff = absenceCutoff(value, unit);

  const withAgeGroup = (d: RawDeaconContact): DeaconContact => ({
    id: d.id,
    name: d.name,
    first_name: d.first_name,
    phone: d.phone,
    email: d.email,
    location_prefs: d.location_prefs,
    liturgy_prefs: d.liturgy_prefs,
    rank: d.rank,
    age_group: computeAgeGroup(d.dob, d.age_group_override, ageGroupYouthMin, ageGroupAdultMin),
  });

  const { rows: absentRaw } = await query<RawDeaconContact>(
    `${CONTACT_SELECT}
     where d.status = 'Active'
       and not d.is_guest
       and ${ABSENT_PREDICATE}
     order by d.name`,
    [cutoff]
  );

  return { absentCount: absentRaw.length, absentDeacons: absentRaw.map(withAgeGroup) };
}

/**
 * Recomputes the absent list for an arbitrary period -- used by the
 * Dashboard's "Absent" period dropdown, which is a personal view filter and
 * doesn't touch any persisted setting (see DashboardStatTiles).
 */
export async function getAbsentDeaconsForPeriod(
  value: number,
  unit: AbsencePeriodUnit
): Promise<{ absentCount: number; absentDeacons: DeaconContact[] }> {
  const settings = await getAppSettings();
  return getAbsentContacts(value, unit, settings.ageGroupYouthMin, settings.ageGroupAdultMin);
}

/** Every active, non-guest deacon's contact details -- the list behind the Active, "No Phone" and "No Email" tiles. */
export async function getActiveDeaconContacts(): Promise<DeaconContact[]> {
  const settings = await getAppSettings();
  const { rows } = await query<RawDeaconContact>(
    `${CONTACT_SELECT} where d.status = 'Active' and not d.is_guest order by d.name`
  );
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    first_name: d.first_name,
    phone: d.phone,
    email: d.email,
    location_prefs: d.location_prefs,
    liturgy_prefs: d.liturgy_prefs,
    rank: d.rank,
    age_group: computeAgeGroup(d.dob, d.age_group_override, settings.ageGroupYouthMin, settings.ageGroupAdultMin),
  }));
}

/** All tiles exclude Archived deacons (spec §7.2) and Guests (visitors aren't regular roster). */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { rows } = await query<{
    active: string;
    guests: string;
    absent: string;
    missing_phone: string;
    missing_email: string;
  }>(
    `select
       count(*) filter (where not d.is_guest) as active,
       count(*) filter (where d.is_guest) as guests,
       count(*) filter (where not d.is_guest and ${ABSENT_PREDICATE}) as absent,
       count(*) filter (where not d.is_guest and coalesce(d.phone, '') = '') as missing_phone,
       count(*) filter (where not d.is_guest and coalesce(d.email, '') = '') as missing_email
     from deacons d
     where d.status = 'Active'`,
    [absenceCutoff(DEFAULT_ABSENCE_VALUE, DEFAULT_ABSENCE_UNIT)]
  );
  const r = rows[0];

  return {
    activeDeaconsCount: Number(r.active),
    guestCount: Number(r.guests),
    absentCount: Number(r.absent),
    absencePeriodValue: DEFAULT_ABSENCE_VALUE,
    absencePeriodUnit: DEFAULT_ABSENCE_UNIT,
    missingPhoneCount: Number(r.missing_phone),
    missingEmailCount: Number(r.missing_email),
  };
}
