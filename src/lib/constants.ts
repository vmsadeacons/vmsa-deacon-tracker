// A liturgy is recorded as just an ordinal within its day (1st/2nd/3rd) --
// day-of-week is no longer encoded here (see date instead), and a "Special
// Feast" is an orthogonal flag on the liturgy (is_special_feast/feast_name),
// not a service type. This lets any day have up to two liturgies, not just
// Sunday, and a feast to fall on any day of the week. A 3rd ordinal exists
// for an extra liturgy added on a Sunday (or a second extra on a weekday);
// there is deliberately no 4th.
export const SERVICE_TYPES = ["S1", "S2", "S3"] as const;
export type ServiceTypeCode = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<ServiceTypeCode, string> = {
  S1: "1st Liturgy",
  S2: "2nd Liturgy",
  S3: "3rd Liturgy",
};

// Deacon "preferred service" vocabulary -- kept distinct from SERVICE_TYPES
// (and from its old day-coded values) so existing preferences didn't need
// re-entry when service types were simplified. S1/S2 here specifically mean
// Sunday's two liturgies (matched by ordinal); Wed/Fri/Sat mean "any liturgy
// that day, whichever ordinal" (matched by the liturgy's date); Feast means
// "any liturgy flagged as a special feast, whatever day it falls on"
// (matched by is_special_feast) -- see liturgyPrefMatchCodes in timezone.ts.
export const LITURGY_PREF_TYPES = ["S1", "S2", "Wed", "Fri", "Sat", "Feast"] as const;
export type LiturgyPrefCode = (typeof LITURGY_PREF_TYPES)[number];

export const LITURGY_PREF_LABELS: Record<LiturgyPrefCode, string> = {
  S1: "Sunday 1st Liturgy",
  S2: "Sunday 2nd Liturgy",
  Wed: "Wednesday Liturgy",
  Fri: "Friday Liturgy",
  Sat: "Saturday Liturgy",
  Feast: "Special Feast Liturgy",
};

// Ranks are now a real admin-editable table (src/lib/repo/ranks.ts), not a
// fixed list -- see the ranks table in Settings.

export const AGE_GROUPS = ["Child", "Youth", "Adult"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const ROLES = ["SystemAdmin", "GeneralAdmin", "Deacon"] as const;
export type Role = (typeof ROLES)[number];

export const ALL_SENTINEL = "All";

// ---------------------------------------------------------------------------
// Passion Week — structural, fixed. Not drawn from the activities table.
// ---------------------------------------------------------------------------

export const PW_SERVICES = [
  { id: "sun_eve", label: "Sunday Evening (Eve of Monday)" },
  { id: "mon_morn", label: "Monday Morning" },
  { id: "mon_eve", label: "Monday Evening (Eve of Tuesday)" },
  { id: "tue_morn", label: "Tuesday Morning" },
  { id: "tue_eve", label: "Tuesday Evening (Eve of Wednesday)" },
  { id: "wed_morn", label: "Wednesday Morning" },
  { id: "wed_eve", label: "Wednesday Evening (Eve of Thursday)" },
  { id: "thu_morn", label: "Thursday Morning" },
  { id: "thu_eve", label: "Thursday Evening (Eve of Friday)" },
  { id: "good_fri", label: "Good Friday" },
] as const;
export type PWServiceId = (typeof PW_SERVICES)[number]["id"];

// The two 4-reader-per-hour services.
export const PW_FOUR_READER_SERVICES: PWServiceId[] = ["thu_eve", "good_fri"];

export const PW_HOURS = ["1st", "3rd", "6th", "9th", "11th"] as const;
export const PW_HOUR_WITH_12TH = [...PW_HOURS, "12th"] as const;
export type PWHour = (typeof PW_HOUR_WITH_12TH)[number];

export function pwHoursFor(serviceId: PWServiceId): readonly PWHour[] {
  return serviceId === "good_fri" ? PW_HOUR_WITH_12TH : PW_HOURS;
}

export const PW_ACTIVITIES = [
  { id: "PC1", label: "Psalm Coptic 1" },
  { id: "PC2", label: "Psalm Coptic 2" },
  { id: "GC", label: "Gospel Coptic" },
  { id: "GE", label: "Gospel English" },
] as const;
export type PWActivityId = (typeof PW_ACTIVITIES)[number]["id"];

export function pwSlotCount(serviceId: PWServiceId, activityId: PWActivityId): number {
  const isFourReader = PW_FOUR_READER_SERVICES.includes(serviceId);
  const isGospel = activityId === "GC" || activityId === "GE";
  return isFourReader && isGospel ? 4 : 1;
}

export function pwServiceLabel(id: string): string {
  return PW_SERVICES.find((s) => s.id === id)?.label ?? id;
}

export function pwActivityLabel(id: string): string {
  return PW_ACTIVITIES.find((a) => a.id === id)?.label ?? id;
}
