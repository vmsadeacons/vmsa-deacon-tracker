// All "what is today / what time is it right now" logic must use the
// church's own local timezone, regardless of server or browser timezone.
// See spec §8.3.

const TZ = process.env.CHURCH_TIMEZONE || "America/New_York";

export type ServiceType = "S1" | "S2";

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

export function churchNowHour(): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  // "24" is used by some locales/environments for midnight; normalize to 0.
  return parseInt(hourStr, 10) % 24;
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
 * Default ordinal for a given date. Sunday keeps its 1st-before-9am/
 * 2nd-at-or-after-9am church-local-time split (a Sunday that isn't "today"
 * has no current time to anchor that to, so it defaults to 2nd); every
 * other day defaults to 1st, since most days only ever get one liturgy --
 * the admin picks 2nd manually on a day that gets a second (e.g. a special
 * feast alongside the regular liturgy). Day-of-week is no longer part of
 * the service type itself; see the `date` field for that.
 */
export function computeDefaultServiceType(dateStr: string): ServiceType {
  if (weekdayOfDateString(dateStr) === 0) {
    const isToday = dateStr === churchTodayISO();
    if (!isToday) return "S2";
    return churchNowHour() < 9 ? "S1" : "S2";
  }
  return "S1";
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
      return [serviceType];
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
