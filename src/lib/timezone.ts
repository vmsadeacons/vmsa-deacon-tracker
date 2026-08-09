// All "what is today / what time is it right now" logic must use the
// church's own local timezone, regardless of server or browser timezone.
// See spec §8.3.

const TZ = process.env.CHURCH_TIMEZONE || "America/New_York";

export type ServiceType = "S1" | "S2" | "Wed" | "Fri" | "Sat" | "Other";

export function churchTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

/** 0 = Sunday ... 6 = Saturday, for a plain YYYY-MM-DD calendar date. */
function weekdayOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}

/**
 * Default service type for a given date, per spec §8.3:
 * Wed/Fri/Sat -> that day's own liturgy; Mon/Tue/Thu -> Other/Special;
 * Sunday -> 1st before 9am church-local time, 2nd at/after 9am. A Sunday
 * that isn't "today" has no current time to anchor the AM/PM split to, so
 * it defaults to 2nd.
 */
export function computeDefaultServiceType(dateStr: string): ServiceType {
  const weekday = weekdayOfDateString(dateStr);
  switch (weekday) {
    case 3:
      return "Wed";
    case 5:
      return "Fri";
    case 6:
      return "Sat";
    case 1:
    case 2:
    case 4:
      return "Other";
    case 0: {
      const isToday = dateStr === churchTodayISO();
      if (!isToday) return "S2";
      return churchNowHour() < 9 ? "S1" : "S2";
    }
    default:
      return "Other";
  }
}

/** N calendar months before church-local "today", as YYYY-MM-DD. */
export function monthsAgoISO(months: number): string {
  const todayStr = churchTodayISO();
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
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
