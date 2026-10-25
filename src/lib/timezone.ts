// All "what is today / what time is it right now" logic must use the
// church's own local timezone, regardless of server or browser timezone.
// See spec §8.3.

const TZ = process.env.CHURCH_TIMEZONE || "America/New_York";

export type ServiceType = "S1" | "S2" | "S3";

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function churchTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** January 1 of the current church-local year, as YYYY-MM-DD — for "year to date" periods. */
export function yearStartISO(): string {
  return `${churchTodayISO().slice(0, 4)}-01-01`;
}

/** Current time in the church's local timezone, as "HH:MM" (24-hour) -- for comparing against a configured cutoff. */
export function churchNowTimeString(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Minutes since local midnight for an "HH:MM" string. */
export function minutesOfTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Church-local "now" as minutes since midnight. */
export function churchNowMinutes(): number {
  return minutesOfTime(churchNowTimeString());
}

/** 0 = Sunday ... 6 = Saturday, for a plain YYYY-MM-DD calendar date. */
export function weekdayOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}

/** Full weekday name for a plain YYYY-MM-DD calendar date -- informational display only. */
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_NAMES[weekdayOfDateString(dateStr)];
}

/**
 * The deacon "preferred service" code(s) (see LITURGY_PREF_TYPES) that a
 * given liturgy satisfies: Sunday matches by its actual ordinal (S1/S2);
 * Wed/Fri/Sat match any liturgy that day regardless of ordinal; other
 * weekdays have no day-based preference. "Feast" is intentionally not
 * included here -- callers should add it themselves when the liturgy is
 * flagged is_special_feast, since that's independent of the date.
 */
export function liturgyPrefMatchCodes(dateStr: string, serviceType: ServiceType): string[] {
  switch (weekdayOfDateString(dateStr)) {
    case 0:
      // A Sunday's 3rd (extra) liturgy has no preference code of its own, so
      // it's offered to anyone who prefers either regular Sunday liturgy.
      return serviceType === "S3" ? ["S1", "S2"] : [serviceType];
    case 3:
      return ["Wed"];
    case 5:
      return ["Fri"];
    case 6:
      return ["Sat"];
    default:
      return [];
  }
}

/** N calendar months before church-local "today", as YYYY-MM-DD. */
export function monthsAgoISO(months: number): string {
  const todayStr = churchTodayISO();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  return dt.toISOString().slice(0, 10);
}

/** N days before church-local "today", as YYYY-MM-DD — exact, for week-granularity cutoffs. */
export function daysAgoISO(days: number): string {
  const todayStr = churchTodayISO();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Coptic Holy Week only ever falls in April or May. A Holy Week `year`'s
 * records are included in a report period if the period overlaps that
 * year's April 1 - May 31 window (standard interval-overlap test; an
 * open-ended period bound counts as -Infinity/+Infinity). See spec §7.9.2.
 */
export function passionWeekYearOverlapsRange(
  year: number,
  fromDate: string | null,
  toDate: string | null
): boolean {
  const windowStart = `${year}-04-01`;
  const windowEnd = `${year}-05-31`;
  const from = fromDate ?? "0000-01-01";
  const to = toDate ?? "9999-12-31";
  return from <= windowEnd && to >= windowStart;
}
