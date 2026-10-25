import { query, withTransaction } from "@/lib/db";
import { SERVICE_TYPES, SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import { churchTodayISO, churchNowMinutes, minutesOfTime, weekdayOfDateString } from "@/lib/timezone";
import { formatTime12, minutesToHHMM } from "@/lib/formatTime";

// ---------------------------------------------------------------------------
// The liturgy schedule, and which single liturgy is "open" for check-in.
//
//  * Schedule: every church has 1 liturgy a day, 2 on Sundays, plus any
//    admin-added extras (at most 3 in a day, so a Sunday can take one extra).
//    It's a *rule*, not stored rows -- only the extras are stored -- so there
//    is nothing to pre-generate and nothing to run on a timer.
//  * Open window: a liturgy opens for check-in OPEN_LEAD_MINUTES before it
//    starts and closes when the next one's window opens, or MAX_OPEN_MINUTES
//    after its own start, whichever is first. Windows therefore never
//    overlap: at most one liturgy per church is open at any moment, worked
//    out from the clock when somebody checks in (no cron, no polling).
//  * Admin override: an admin can force a liturgy open or closed. A forced-
//    open liturgy wins over the automatic window (and closes the rest).
// ---------------------------------------------------------------------------

export const OPEN_LEAD_MINUTES = 30;
export const MAX_OPEN_MINUTES = 180;

// Used until an admin saves real times for a church/weekday (Settings →
// Liturgy Start Times). Placeholders, deliberately flagged as "default" in
// the UI so nobody mistakes them for confirmed times.
const DEFAULT_START_TIMES = {
  weekday: { S1: "09:00", S2: "18:00", S3: "20:00" },
  sunday: { S1: "07:30", S2: "10:00", S3: "12:30" },
} as const satisfies Record<string, Record<ServiceTypeCode, string>>;

const FALLBACK_SCHEDULE_START_DATE = "2026-10-24";
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function defaultStartTime(weekday: number, serviceType: ServiceTypeCode): string {
  return (weekday === 0 ? DEFAULT_START_TIMES.sunday : DEFAULT_START_TIMES.weekday)[serviceType];
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

// ---------------------------------------------------------------------------
// Pure schedule logic (no database) -- exported so it can be tested directly.
// ---------------------------------------------------------------------------

export interface ScheduledLiturgy {
  serviceType: ServiceTypeCode;
  /** "HH:MM", church-local, 24-hour. */
  startTime: string;
  /** Added by an admin on top of the default schedule. */
  isExtra: boolean;
  extraId: string | null;
  /** A liturgy row (attendance/records) already exists for it. */
  hasRecord: boolean;
}

export type StartTimeMap = Map<string, string>; // key: `${weekday}-${serviceType}`

/** The liturgies a church has by rule on a date, before extras. Dates before the schedule start keep the old "any day may have a 1st and 2nd" behaviour. */
export function ruleServices(date: string, scheduleStartDate: string): ServiceTypeCode[] {
  if (date < scheduleStartDate) return ["S1", "S2"];
  return weekdayOfDateString(date) === 0 ? ["S1", "S2"] : ["S1"];
}

export function buildSchedule(p: {
  date: string;
  scheduleStartDate: string;
  startTimes: StartTimeMap;
  extras: { id: string; service_type: ServiceTypeCode; start_time: string | null }[];
  existing: ServiceTypeCode[];
}): ScheduledLiturgy[] {
  const weekday = weekdayOfDateString(p.date);
  const timeFor = (s: ServiceTypeCode) => p.startTimes.get(`${weekday}-${s}`) ?? defaultStartTime(weekday, s);
  const byService = new Map<ServiceTypeCode, ScheduledLiturgy>();

  for (const s of ruleServices(p.date, p.scheduleStartDate)) {
    byService.set(s, { serviceType: s, startTime: timeFor(s), isExtra: false, extraId: null, hasRecord: false });
  }
  for (const e of p.extras) {
    byService.set(e.service_type, {
      serviceType: e.service_type,
      startTime: e.start_time ?? timeFor(e.service_type),
      isExtra: true,
      extraId: e.id,
      hasRecord: false,
    });
  }
  // A liturgy that already has records stays visible even if the rule or an
  // extra wouldn't have produced it (e.g. one recorded by hand), so nothing
  // already on the books ever disappears from a picker.
  for (const s of p.existing) {
    const found = byService.get(s);
    if (found) found.hasRecord = true;
    else byService.set(s, { serviceType: s, startTime: timeFor(s), isExtra: false, extraId: null, hasRecord: true });
  }

  return [...byService.values()].sort(
    (a, b) => minutesOfTime(a.startTime) - minutesOfTime(b.startTime) || a.serviceType.localeCompare(b.serviceType)
  );
}

export type OverrideState = "open" | "closed";
export type CheckinStatus = "open" | "upcoming" | "closed";

export interface LiturgyStatus extends ScheduledLiturgy {
  status: CheckinStatus;
  /** Short human explanation shown next to the status. */
  note: string;
  override: OverrideState | null;
  /** "HH:MM" the automatic window opens. */
  opensAt: string;
}

/**
 * Which liturgy is open for check-in at `nowMin` (minutes since midnight),
 * and the status of each. `items` must be sorted by start time. `overrides`
 * maps a service type to an admin's manual open/close plus when it was set.
 */
export function computeOpenStatus(
  items: ScheduledLiturgy[],
  overrides: Map<ServiceTypeCode, { state: OverrideState; setAtMs: number }>,
  nowMin: number
): { items: LiturgyStatus[]; open: ServiceTypeCode | null } {
  const openAt = items.map((it) => minutesOfTime(it.startTime) - OPEN_LEAD_MINUTES);
  const autoCloseAt = items.map((it, i) => {
    const byDuration = minutesOfTime(it.startTime) + MAX_OPEN_MINUTES;
    const nextOpen = i + 1 < items.length ? openAt[i + 1] : Infinity;
    return Math.min(byDuration, nextOpen);
  });

  // A forced-open liturgy wins; if several somehow exist, the most recent.
  let forcedIdx = -1;
  items.forEach((it, i) => {
    const o = overrides.get(it.serviceType);
    if (o?.state === "open" && (forcedIdx === -1 || o.setAtMs > overrides.get(items[forcedIdx].serviceType)!.setAtMs)) {
      forcedIdx = i;
    }
  });

  let openIdx = forcedIdx;
  if (openIdx === -1) {
    openIdx = items.findIndex(
      (it, i) => overrides.get(it.serviceType)?.state !== "closed" && openAt[i] <= nowMin && nowMin < autoCloseAt[i]
    );
  }

  const result: LiturgyStatus[] = items.map((it, i) => {
    const override = overrides.get(it.serviceType)?.state ?? null;
    const base = { ...it, override, opensAt: minutesToHHMM(openAt[i]) };
    if (i === openIdx) {
      return { ...base, status: "open", note: override === "open" ? "Opened by an admin" : "Open for check-in" };
    }
    if (override === "closed") return { ...base, status: "closed", note: "Closed by an admin" };
    if (forcedIdx !== -1) return { ...base, status: "closed", note: "Locked — another liturgy was opened by an admin" };
    if (nowMin < openAt[i]) return { ...base, status: "upcoming", note: `Opens at ${formatTime12(minutesToHHMM(openAt[i]))}` };
    return { ...base, status: "closed", note: "Check-in has closed" };
  });

  return { items: result, open: openIdx === -1 ? null : items[openIdx].serviceType };
}

/** The ordinal a Record/Reports picker should start on for a date. */
export function pickDefaultService(items: ScheduledLiturgy[], date: string, today: string, nowMin: number): ServiceTypeCode {
  if (items.length === 0) return "S1";
  if (date === today) {
    // The latest liturgy whose window has opened (so "now" lands on the
    // one in progress); before any has opened, the first of the day.
    let pick = items[0];
    for (const it of items) if (minutesOfTime(it.startTime) - OPEN_LEAD_MINUTES <= nowMin) pick = it;
    return pick.serviceType;
  }
  if (date < today) {
    // Past Sunday: keep the old habit of defaulting to the 2nd liturgy.
    return weekdayOfDateString(date) === 0 && items.some((i) => i.serviceType === "S2") ? "S2" : items[0].serviceType;
  }
  return items[0].serviceType;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function getScheduleStartDate(): Promise<string> {
  const { rows } = await query<{ value: string }>(`select value from app_settings where key = 'schedule_start_date'`);
  return rows[0]?.value ?? FALLBACK_SCHEDULE_START_DATE;
}

async function loadStartTimes(locationIds: string[]): Promise<Map<string, StartTimeMap>> {
  const { rows } = await query<{ location_id: string; weekday: number; service_type: ServiceTypeCode; start_time: string }>(
    `select location_id, weekday, service_type, start_time from liturgy_start_times where location_id = any($1)`,
    [locationIds]
  );
  const out = new Map<string, StartTimeMap>(locationIds.map((id) => [id, new Map()]));
  for (const r of rows) out.get(r.location_id)!.set(`${r.weekday}-${r.service_type}`, r.start_time);
  return out;
}

/** Schedules for several churches on one date, with a handful of batched queries. */
async function loadSchedules(locationIds: string[], date: string): Promise<Map<string, ScheduledLiturgy[]>> {
  const [startDate, startTimes, extras, existing] = await Promise.all([
    getScheduleStartDate(),
    loadStartTimes(locationIds),
    query<{ id: string; location_id: string; service_type: ServiceTypeCode; start_time: string | null }>(
      `select id, location_id, service_type, start_time from extra_liturgies where date = $1 and location_id = any($2)`,
      [date, locationIds]
    ),
    query<{ location_id: string; service_type: ServiceTypeCode }>(
      `select location_id, service_type from liturgies where date = $1 and location_id = any($2)`,
      [date, locationIds]
    ),
  ]);
  const out = new Map<string, ScheduledLiturgy[]>();
  for (const id of locationIds) {
    out.set(
      id,
      buildSchedule({
        date,
        scheduleStartDate: startDate,
        startTimes: startTimes.get(id)!,
        extras: extras.rows.filter((e) => e.location_id === id),
        existing: existing.rows.filter((e) => e.location_id === id).map((e) => e.service_type),
      })
    );
  }
  return out;
}

async function loadOverrides(locationIds: string[], date: string) {
  const { rows } = await query<{ location_id: string; service_type: ServiceTypeCode; state: OverrideState; set_at: string }>(
    `select location_id, service_type, state, set_at from liturgy_lock_overrides where date = $1 and location_id = any($2)`,
    [date, locationIds]
  );
  const out = new Map<string, Map<ServiceTypeCode, { state: OverrideState; setAtMs: number }>>(
    locationIds.map((id) => [id, new Map()])
  );
  for (const r of rows) out.get(r.location_id)!.set(r.service_type, { state: r.state, setAtMs: Date.parse(r.set_at) });
  return out;
}

// ---------------------------------------------------------------------------
// What pickers (Record a Liturgy, Reports) offer for a date + church
// ---------------------------------------------------------------------------

export interface ScheduleOption {
  serviceType: ServiceTypeCode;
  label: string;
  startTime: string;
  isExtra: boolean;
}

export async function getScheduleOptions(
  locationId: string,
  date: string
): Promise<{ options: ScheduleOption[]; defaultService: ServiceTypeCode }> {
  const items = (await loadSchedules([locationId], date)).get(locationId)!;
  return {
    options: items.map((it) => ({
      serviceType: it.serviceType,
      label: SERVICE_LABELS[it.serviceType],
      startTime: it.startTime,
      isExtra: it.isExtra,
    })),
    defaultService: pickDefaultService(items, date, churchTodayISO(), churchNowMinutes()),
  };
}

// ---------------------------------------------------------------------------
// Check-in: what is open at a church right now
// ---------------------------------------------------------------------------

export interface OpenLiturgyInfo {
  date: string;
  open: {
    serviceType: ServiceTypeCode;
    startTime: string;
    isSpecialFeast: boolean;
    feastName: string | null;
  } | null;
  /** The next liturgy still to open today, for the "nothing open right now" message. */
  next: { serviceType: ServiceTypeCode; startTime: string; opensAt: string } | null;
}

export async function getOpenLiturgy(locationId: string): Promise<OpenLiturgyInfo> {
  const date = churchTodayISO();
  const [schedules, overrides] = await Promise.all([loadSchedules([locationId], date), loadOverrides([locationId], date)]);
  const { items, open } = computeOpenStatus(schedules.get(locationId)!, overrides.get(locationId)!, churchNowMinutes());

  let openInfo: OpenLiturgyInfo["open"] = null;
  if (open) {
    const it = items.find((i) => i.serviceType === open)!;
    const { rows } = await query<{ is_special_feast: boolean; feast_name: string | null }>(
      `select l.is_special_feast, fn.name as feast_name
       from liturgies l left join feast_names fn on fn.id = l.feast_name_id
       where l.date = $1 and l.location_id = $2 and l.service_type = $3`,
      [date, locationId, open]
    );
    openInfo = {
      serviceType: open,
      startTime: it.startTime,
      isSpecialFeast: Boolean(rows[0]?.is_special_feast),
      feastName: rows[0]?.feast_name ?? null,
    };
  }
  const upcoming = items.find((i) => i.status === "upcoming");
  return {
    date,
    open: openInfo,
    next: upcoming ? { serviceType: upcoming.serviceType, startTime: upcoming.startTime, opensAt: upcoming.opensAt } : null,
  };
}

// ---------------------------------------------------------------------------
// Admin "Check-in" page: today at every church
// ---------------------------------------------------------------------------

export interface TodayLiturgy {
  serviceType: ServiceTypeCode;
  label: string;
  startTime: string;
  isExtra: boolean;
  status: CheckinStatus;
  note: string;
  override: OverrideState | null;
  attendeeCount: number;
}

export interface TodayLocation {
  locationId: string;
  name: string;
  liturgies: TodayLiturgy[];
}

export async function getTodaySnapshot(): Promise<{ date: string; locations: TodayLocation[] }> {
  const date = churchTodayISO();
  const { rows: locs } = await query<{ id: string; name: string }>(
    `select id, name from locations where status = 'Active' order by name`
  );
  const ids = locs.map((l) => l.id);
  if (ids.length === 0) return { date, locations: [] };
  const [schedules, overrides, counts] = await Promise.all([
    loadSchedules(ids, date),
    loadOverrides(ids, date),
    query<{ location_id: string; service_type: ServiceTypeCode; n: string }>(
      `select l.location_id, l.service_type, count(*) as n
       from liturgies l join participation p on p.liturgy_id = l.id
       where l.date = $1 and l.location_id = any($2) and p.activity_id is null
       group by l.location_id, l.service_type`,
      [date, ids]
    ),
  ]);
  const nowMin = churchNowMinutes();
  return {
    date,
    locations: locs.map((loc) => {
      const { items } = computeOpenStatus(schedules.get(loc.id)!, overrides.get(loc.id)!, nowMin);
      return {
        locationId: loc.id,
        name: loc.name,
        liturgies: items.map((it) => ({
          serviceType: it.serviceType,
          label: SERVICE_LABELS[it.serviceType],
          startTime: it.startTime,
          isExtra: it.isExtra,
          status: it.status,
          note: it.note,
          override: it.override,
          attendeeCount: Number(
            counts.rows.find((c) => c.location_id === loc.id && c.service_type === it.serviceType)?.n ?? 0
          ),
        })),
      };
    }),
  };
}

/** Admin override: force a liturgy open or closed for check-in today, or pass null to go back to automatic. */
export async function setLockOverride(
  locationId: string,
  serviceType: ServiceTypeCode,
  state: OverrideState | null,
  userId: string | null
): Promise<void> {
  const date = churchTodayISO();
  const items = (await loadSchedules([locationId], date)).get(locationId)!;
  if (!items.some((i) => i.serviceType === serviceType)) {
    throw new Error("That liturgy isn't on today's schedule");
  }
  await withTransaction(async (client) => {
    if (state === null) {
      await client.query(
        `delete from liturgy_lock_overrides where location_id = $1 and date = $2 and service_type = $3`,
        [locationId, date, serviceType]
      );
      return;
    }
    if (state === "open") {
      // Only one liturgy can be forced open at a church at a time.
      await client.query(
        `delete from liturgy_lock_overrides where location_id = $1 and date = $2 and state = 'open' and service_type <> $3`,
        [locationId, date, serviceType]
      );
    }
    await client.query(
      `insert into liturgy_lock_overrides (location_id, date, service_type, state, set_by, set_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (location_id, date, service_type)
       do update set state = excluded.state, set_by = excluded.set_by, set_at = now()`,
      [locationId, date, serviceType, state, userId]
    );
  });
}

// ---------------------------------------------------------------------------
// Start times (Settings)
// ---------------------------------------------------------------------------

export interface StartTimeCell {
  weekday: number;
  serviceType: ServiceTypeCode;
  time: string;
  /** No admin-saved value yet -- showing the built-in placeholder. */
  isDefault: boolean;
}

export async function listStartTimes(locationId: string): Promise<StartTimeCell[]> {
  const saved = (await loadStartTimes([locationId])).get(locationId)!;
  const cells: StartTimeCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (const serviceType of SERVICE_TYPES) {
      const time = saved.get(`${weekday}-${serviceType}`);
      cells.push({ weekday, serviceType, time: time ?? defaultStartTime(weekday, serviceType), isDefault: time === undefined });
    }
  }
  return cells;
}

export async function setStartTimesForDay(
  locationId: string,
  weekday: number,
  times: Record<ServiceTypeCode, string>
): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Invalid day");
  for (const s of SERVICE_TYPES) {
    if (!isValidTime(times[s])) throw new Error(`Enter a valid time for the ${SERVICE_LABELS[s]}`);
  }
  if (!(times.S1 < times.S2 && times.S2 < times.S3)) {
    throw new Error("The 1st, 2nd and 3rd liturgy times need to be in order, each later than the one before");
  }
  await withTransaction(async (client) => {
    for (const s of SERVICE_TYPES) {
      await client.query(
        `insert into liturgy_start_times (location_id, weekday, service_type, start_time) values ($1, $2, $3, $4)
         on conflict (location_id, weekday, service_type) do update set start_time = excluded.start_time`,
        [locationId, weekday, s, times[s]]
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Extra liturgies
// ---------------------------------------------------------------------------

export interface ExtraRow {
  id: string;
  locationId: string;
  locationName: string;
  date: string;
  serviceType: ServiceTypeCode;
  startTime: string;
  seriesId: string | null;
  hasRecord: boolean;
}

function assertNotPast(date: string) {
  if (date < churchTodayISO()) throw new Error("Extra liturgies can only be added for today or a later date");
}

function nextFreeOrdinal(used: Set<ServiceTypeCode>): ServiceTypeCode | null {
  return SERVICE_TYPES.find((s) => !used.has(s)) ?? null;
}

/** Adds one extra liturgy to a church on a date, taking the next free ordinal (a weekday's extra is its 2nd, a Sunday's its 3rd). */
export async function addExtraLiturgy(
  locationId: string,
  date: string,
  startTime: string | null,
  createdBy: string | null
): Promise<{ serviceType: ServiceTypeCode }> {
  assertNotPast(date);
  if (startTime !== null && !isValidTime(startTime)) throw new Error("Enter a valid start time");
  const { rows: loc } = await query<{ id: string }>(`select id from locations where id = $1 and status = 'Active'`, [locationId]);
  if (loc.length === 0) throw new Error("Choose an active church");

  const items = (await loadSchedules([locationId], date)).get(locationId)!;
  const free = nextFreeOrdinal(new Set(items.map((i) => i.serviceType)));
  if (!free) throw new Error("That church already has 3 liturgies on that day, which is the most the app allows");

  try {
    await query(
      `insert into extra_liturgies (location_id, date, service_type, start_time, created_by) values ($1, $2, $3, $4, $5)`,
      [locationId, date, free, startTime, createdBy]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new Error("Someone just added a liturgy for that day — please refresh and try again");
    throw err;
  }
  return { serviceType: free };
}

export interface RecurringInput {
  locationIds: string[];
  weekdays: number[];
  from: string;
  to: string;
  startTime: string | null;
}

export interface RecurringPlan {
  planned: { locationId: string; date: string; serviceType: ServiceTypeCode }[];
  skippedHasExtra: number;
  skippedFull: number;
}

const MAX_SERIES_DAYS = 400;

/** What a repeating add would do, without writing anything. Days that already have an extra at that church are skipped, so running it twice never doubles up. */
export async function planRecurringExtras(input: RecurringInput): Promise<RecurringPlan> {
  const { locationIds, weekdays, from, to, startTime } = input;
  if (locationIds.length === 0) throw new Error("Choose at least one church");
  if (weekdays.length === 0 || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("Choose at least one day of the week");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Enter a start and end date");
  if (to < from) throw new Error("The end date is before the start date");
  assertNotPast(from);
  if (startTime !== null && !isValidTime(startTime)) throw new Error("Enter a valid start time");

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (dates.length > MAX_SERIES_DAYS) throw new Error(`Please keep a repeating series to ${MAX_SERIES_DAYS} days or fewer`);
    if (weekdays.includes(weekdayOfDateString(d))) dates.push(d);
  }

  const { rows: locs } = await query<{ id: string }>(
    `select id from locations where id = any($1) and status = 'Active'`,
    [locationIds]
  );
  if (locs.length !== new Set(locationIds).size) throw new Error("One of the chosen churches isn't active");

  const [startDate, extras, existing] = await Promise.all([
    getScheduleStartDate(),
    query<{ location_id: string; date: string }>(
      `select location_id, date from extra_liturgies where location_id = any($1) and date between $2 and $3`,
      [locationIds, from, to]
    ),
    query<{ location_id: string; date: string; service_type: ServiceTypeCode }>(
      `select location_id, date, service_type from liturgies where location_id = any($1) and date between $2 and $3`,
      [locationIds, from, to]
    ),
  ]);
  const hasExtra = new Set(extras.rows.map((e) => `${e.location_id}|${e.date}`));
  const existingBy = new Map<string, ServiceTypeCode[]>();
  for (const e of existing.rows) {
    const k = `${e.location_id}|${e.date}`;
    existingBy.set(k, [...(existingBy.get(k) ?? []), e.service_type]);
  }

  const plan: RecurringPlan = { planned: [], skippedHasExtra: 0, skippedFull: 0 };
  for (const locationId of new Set(locationIds)) {
    for (const date of dates) {
      const key = `${locationId}|${date}`;
      if (hasExtra.has(key)) {
        plan.skippedHasExtra++;
        continue;
      }
      const used = new Set<ServiceTypeCode>([...ruleServices(date, startDate), ...(existingBy.get(key) ?? [])]);
      const free = nextFreeOrdinal(used);
      if (!free) plan.skippedFull++;
      else plan.planned.push({ locationId, date, serviceType: free });
    }
  }
  return plan;
}

export async function addRecurringExtras(
  input: RecurringInput,
  createdBy: string | null
): Promise<{ created: number; skippedHasExtra: number; skippedFull: number }> {
  const plan = await planRecurringExtras(input);
  if (plan.planned.length === 0) return { created: 0, skippedHasExtra: plan.skippedHasExtra, skippedFull: plan.skippedFull };
  const seriesId = crypto.randomUUID();
  const { rowCount } = await query(
    `insert into extra_liturgies (location_id, date, service_type, start_time, series_id, created_by)
     select loc, d::date, s, $4, $5::uuid, $6::uuid
     from unnest($1::uuid[], $2::text[], $3::text[]) as t(loc, d, s)
     on conflict (location_id, date, service_type) do nothing`,
    [
      plan.planned.map((p) => p.locationId),
      plan.planned.map((p) => p.date),
      plan.planned.map((p) => p.serviceType),
      input.startTime,
      seriesId,
      createdBy,
    ]
  );
  return { created: rowCount ?? 0, skippedHasExtra: plan.skippedHasExtra, skippedFull: plan.skippedFull };
}

export async function listUpcomingExtras(): Promise<ExtraRow[]> {
  const today = churchTodayISO();
  const { rows } = await query<{
    id: string;
    location_id: string;
    location_name: string;
    date: string;
    service_type: ServiceTypeCode;
    start_time: string | null;
    series_id: string | null;
    has_record: boolean;
  }>(
    `select e.id, e.location_id, loc.name as location_name, e.date, e.service_type, e.start_time, e.series_id,
            exists (select 1 from liturgies l join participation p on p.liturgy_id = l.id
                    where l.date = e.date and l.location_id = e.location_id and l.service_type = e.service_type) as has_record
     from extra_liturgies e join locations loc on loc.id = e.location_id
     where e.date >= $1
     order by e.date, loc.name, e.service_type`,
    [today]
  );
  if (rows.length === 0) return [];
  const times = await loadStartTimes([...new Set(rows.map((r) => r.location_id))]);
  return rows.map((r) => {
    const weekday = weekdayOfDateString(r.date);
    return {
      id: r.id,
      locationId: r.location_id,
      locationName: r.location_name,
      date: r.date,
      serviceType: r.service_type,
      startTime: r.start_time ?? times.get(r.location_id)!.get(`${weekday}-${r.service_type}`) ?? defaultStartTime(weekday, r.service_type),
      seriesId: r.series_id,
      hasRecord: r.has_record,
    };
  });
}

const HAS_RECORDS_SQL = `exists (select 1 from liturgies l join participation p on p.liturgy_id = l.id
  where l.date = e.date and l.location_id = e.location_id and l.service_type = e.service_type)`;

export async function removeExtra(id: string): Promise<void> {
  const { rows } = await query<{ has_record: boolean }>(
    `select ${HAS_RECORDS_SQL} as has_record from extra_liturgies e where e.id = $1`,
    [id]
  );
  if (rows.length === 0) return;
  if (rows[0].has_record) throw new Error("That liturgy already has attendance recorded, so it can't be removed");
  await query(`delete from extra_liturgies where id = $1`, [id]);
}

/** Removes every upcoming date in a series that has no attendance yet; returns how many were removed and how many kept. */
export async function removeExtraSeries(seriesId: string): Promise<{ removed: number; kept: number }> {
  const today = churchTodayISO();
  const { rowCount: removed } = await query(
    `delete from extra_liturgies e
     where e.series_id = $1 and e.date >= $2 and not ${HAS_RECORDS_SQL}`,
    [seriesId, today]
  );
  const { rows } = await query<{ n: string }>(
    `select count(*) as n from extra_liturgies where series_id = $1 and date >= $2`,
    [seriesId, today]
  );
  return { removed: removed ?? 0, kept: Number(rows[0].n) };
}
