import { query, withTransaction } from "@/lib/db";
import { SERVICE_TYPES, SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import {
  churchTodayISO,
  churchNowMinutes,
  minutesOfTime,
  weekdayOfDateString,
  addDaysISO,
  daysBetweenISO,
} from "@/lib/timezone";
import { formatTime12, wrapMinutesToHHMM } from "@/lib/formatTime";

// ---------------------------------------------------------------------------
// The liturgy schedule, and which single liturgy is "open" for check-in.
//
//  * Schedule: every church has 1 liturgy a day, 2 on Sundays (those times
//    are set per church and weekday), plus any admin-added extras (each with
//    its own start time; at most 3 liturgies in a day). It's a *rule*, not
//    stored rows -- only the extras are stored -- so there is nothing to
//    pre-generate and nothing to run on a timer.
//  * A liturgy's 1st/2nd/3rd position is its place in the day's chronological
//    order, never stored: an extra that starts the evening before (a midnight
//    liturgy) is therefore that day's 1st, and the regular liturgies follow it.
//  * Open window: a liturgy opens `openBefore` minutes before it starts and
//    closes `closeAfter` minutes after it starts, or when the next liturgy's
//    window opens, whichever comes first. Windows never overlap, so at most
//    one liturgy per church is open at any moment, worked out from the clock
//    when somebody checks in. Windows can span midnight.
//  * Admin override: an admin can force a liturgy open or closed. A forced-
//    open liturgy wins over the automatic window (and closes the rest).
// ---------------------------------------------------------------------------

export const DEFAULT_OPEN_BEFORE_MINUTES = 30;
export const DEFAULT_CLOSE_AFTER_MINUTES = 180;
export const MAX_LITURGIES_PER_DAY = 3;

const FALLBACK_SCHEDULE_START_DATE = "2026-10-24";
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export interface WindowSettings {
  /** Minutes before a liturgy's start that check-in opens. */
  openBefore: number;
  /** Minutes after a liturgy's start that check-in closes. */
  closeAfter: number;
}

// Used until an admin saves real times for a church/weekday (Check-in
// windows → Liturgy Start Times). Placeholders, deliberately flagged as
// "default" in the UI so nobody mistakes them for confirmed times.
export function defaultRegularStartTime(weekday: number, slot: "S1" | "S2"): string | null {
  if (weekday === 0) return slot === "S1" ? "07:30" : "10:00";
  return slot === "S1" ? "09:00" : null;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

// ---------------------------------------------------------------------------
// Pure schedule logic (no database) -- exported so it can be tested directly.
// ---------------------------------------------------------------------------

export interface ScheduledLiturgy {
  /** Stable identity: "r1" | "r2" (the regular liturgies), `x:<id>` (an extra), `rec:<ordinal>` (recorded but not on the schedule). */
  slot: string;
  /** Position in the day's chronological order. */
  serviceType: ServiceTypeCode;
  /** "HH:MM", church-local, 24-hour; null only for a recorded liturgy with no known time. */
  startTime: string | null;
  /** Starts the evening before the day it counts for. */
  startsEveningBefore: boolean;
  isExtra: boolean;
  extraId: string | null;
  /** A liturgy row (attendance/records) already exists for it. */
  hasRecord: boolean;
  /** Which deacon "preferred service" codes this liturgy satisfies. */
  prefCodes: string[];
}

export type StartTimeMap = Map<string, string>; // key: `${weekday}-${S1|S2}`

export interface ExtraInput {
  id: string;
  start_time: string;
  starts_evening_before: boolean;
}

function prefCodesFor(weekday: number, kind: "r1" | "r2" | "other"): string[] {
  if (weekday === 0) return kind === "r1" ? ["S1"] : kind === "r2" ? ["S2"] : ["S1", "S2"];
  const day = weekday === 3 ? "Wed" : weekday === 5 ? "Fri" : weekday === 6 ? "Sat" : null;
  return day ? [day] : [];
}

/** Minutes from the start of the day the liturgy counts for (negative when it starts the evening before). */
function relStart(it: { startTime: string | null; startsEveningBefore: boolean }): number {
  if (it.startTime === null) return Number.POSITIVE_INFINITY;
  return (it.startsEveningBefore ? -1440 : 0) + minutesOfTime(it.startTime);
}

export function buildSchedule(p: {
  date: string;
  scheduleStartDate: string;
  startTimes: StartTimeMap;
  extras: ExtraInput[];
  existing: ServiceTypeCode[];
}): ScheduledLiturgy[] {
  const weekday = weekdayOfDateString(p.date);
  // Dates before the schedule start keep the old "any day may have a 1st and a 2nd" behaviour.
  const hasRegularSecond = weekday === 0 || p.date < p.scheduleStartDate;

  type Draft = Omit<ScheduledLiturgy, "serviceType" | "hasRecord"> & { order: number };
  const drafts: Draft[] = [];
  drafts.push({
    slot: "r1",
    startTime: p.startTimes.get(`${weekday}-S1`) ?? defaultRegularStartTime(weekday, "S1"),
    startsEveningBefore: false,
    isExtra: false,
    extraId: null,
    prefCodes: prefCodesFor(weekday, "r1"),
    order: 0,
  });
  if (hasRegularSecond) {
    drafts.push({
      slot: "r2",
      startTime: p.startTimes.get(`${weekday}-S2`) ?? defaultRegularStartTime(weekday, "S2"),
      startsEveningBefore: false,
      isExtra: false,
      extraId: null,
      prefCodes: prefCodesFor(weekday, "r2"),
      order: 1,
    });
  }
  for (const e of p.extras) {
    drafts.push({
      slot: `x:${e.id}`,
      startTime: e.start_time,
      startsEveningBefore: e.starts_evening_before,
      isExtra: true,
      extraId: e.id,
      prefCodes: prefCodesFor(weekday, "other"),
      order: 2,
    });
  }

  drafts.sort((a, b) => relStart(a) - relStart(b) || a.order - b.order || a.slot.localeCompare(b.slot));
  const items: ScheduledLiturgy[] = drafts.slice(0, SERVICE_TYPES.length).map((d, i) => ({
    slot: d.slot,
    serviceType: SERVICE_TYPES[i],
    startTime: d.startTime,
    startsEveningBefore: d.startsEveningBefore,
    isExtra: d.isExtra,
    extraId: d.extraId,
    hasRecord: false,
    prefCodes: d.prefCodes,
  }));

  // A liturgy that already has records stays visible even if the schedule
  // wouldn't have produced it (e.g. one recorded by hand), so nothing already
  // on the books ever disappears from a picker.
  for (const s of [...p.existing].sort()) {
    const idx = SERVICE_TYPES.indexOf(s);
    if (idx < items.length) items[idx].hasRecord = true;
    else {
      items.push({
        slot: `rec:${s}`,
        serviceType: s,
        startTime: null,
        startsEveningBefore: false,
        isExtra: false,
        extraId: null,
        hasRecord: true,
        prefCodes: prefCodesFor(weekday, "other"),
      });
    }
  }
  return items;
}

export type OverrideState = "open" | "closed";
export type CheckinStatus = "open" | "upcoming" | "closed";

export interface WindowItem extends ScheduledLiturgy {
  /** The day this liturgy counts for. */
  date: string;
  /** `${date}|${serviceType}` */
  key: string;
  /** Start, in minutes from the beginning of *today* (negative = yesterday evening, 1440+ = tomorrow). */
  absStart: number | null;
}

export function toWindowItems(items: ScheduledLiturgy[], date: string, today: string): WindowItem[] {
  const dayDelta = daysBetweenISO(date, today);
  return items.map((it) => ({
    ...it,
    date,
    key: `${date}|${it.serviceType}`,
    absStart: it.startTime === null ? null : dayDelta * 1440 + relStart(it),
  }));
}

export interface StatusFields {
  status: CheckinStatus;
  /** Short human explanation shown next to the status. */
  note: string;
  override: OverrideState | null;
  /** Automatic window, in minutes from the beginning of today. */
  opensAtAbs: number | null;
  closesAtAbs: number | null;
}

function opensNote(openAtAbs: number): string {
  return `Opens at ${formatTime12(wrapMinutesToHHMM(openAtAbs))}${openAtAbs >= 1440 ? " tomorrow" : ""}`;
}

/**
 * Which liturgy is open for check-in at `nowAbs` (minutes from the beginning
 * of today), and the status of each. `overrides` maps an item key to an
 * admin's manual open/close plus when it was set.
 */
export function computeOpenStatus<T extends { key: string; absStart: number | null }>(
  items: T[],
  overrides: Map<string, { state: OverrideState; setAtMs: number }>,
  nowAbs: number,
  w: WindowSettings
): { items: (T & StatusFields)[]; openKey: string | null } {
  const timed = items
    .filter((it) => it.absStart !== null)
    .sort((a, b) => a.absStart! - b.absStart! || a.key.localeCompare(b.key));
  const untimed = items.filter((it) => it.absStart === null);

  const openAt = timed.map((it) => it.absStart! - w.openBefore);
  const closeAt = timed.map((it, i) => {
    const nextOpen = i + 1 < timed.length ? openAt[i + 1] : Number.POSITIVE_INFINITY;
    return Math.min(it.absStart! + w.closeAfter, nextOpen);
  });

  // A forced-open liturgy wins; if several somehow exist, the most recent.
  let forcedIdx = -1;
  timed.forEach((it, i) => {
    const o = overrides.get(it.key);
    if (o?.state === "open" && (forcedIdx === -1 || o.setAtMs > overrides.get(timed[forcedIdx].key)!.setAtMs)) {
      forcedIdx = i;
    }
  });
  let openIdx = forcedIdx;
  if (openIdx === -1) {
    openIdx = timed.findIndex(
      (it, i) => overrides.get(it.key)?.state !== "closed" && openAt[i] <= nowAbs && nowAbs < closeAt[i]
    );
  }

  const out: (T & StatusFields)[] = timed.map((it, i) => {
    const override = overrides.get(it.key)?.state ?? null;
    const base = { ...it, override, opensAtAbs: openAt[i], closesAtAbs: closeAt[i] };
    if (i === openIdx) {
      return { ...base, status: "open" as const, note: override === "open" ? "Opened by an admin" : "Open for check-in" };
    }
    if (override === "closed") return { ...base, status: "closed" as const, note: "Closed by an admin" };
    if (forcedIdx !== -1) {
      return { ...base, status: "closed" as const, note: "Locked — another liturgy was opened by an admin" };
    }
    if (nowAbs < openAt[i]) return { ...base, status: "upcoming" as const, note: opensNote(openAt[i]) };
    return { ...base, status: "closed" as const, note: "Check-in has closed" };
  });
  for (const it of untimed) {
    out.push({
      ...it,
      override: overrides.get(it.key)?.state ?? null,
      opensAtAbs: null,
      closesAtAbs: null,
      status: "closed",
      note: "No start time on record",
    });
  }
  return { items: out, openKey: openIdx === -1 ? null : timed[openIdx].key };
}

/** The ordinal a Record/Reports picker should start on for a date. */
export function pickDefaultService(
  items: ScheduledLiturgy[],
  date: string,
  today: string,
  nowMin: number,
  w: WindowSettings
): ServiceTypeCode {
  if (items.length === 0) return "S1";
  if (date === today) {
    // The latest liturgy whose window has opened (so "now" lands on the one
    // in progress); before any has opened, the first of the day.
    let pick = items[0];
    for (const it of items) if (it.startTime !== null && relStart(it) - w.openBefore <= nowMin) pick = it;
    return pick.serviceType;
  }
  if (date < today) {
    // Past Sunday: keep the old habit of defaulting to the 2nd liturgy.
    return weekdayOfDateString(date) === 0 && items.some((i) => i.serviceType === "S2") ? "S2" : items[0].serviceType;
  }
  return items[0].serviceType;
}

const RENUMBER_MESSAGE =
  "Adding or removing that liturgy would change the numbering of a liturgy on that day that already has attendance recorded. Choose a start time after the recorded liturgies, or do it before any attendance is recorded.";

/** Throws if going from `before` to `after` would move a liturgy that already has records onto a different position. */
export function assertRecordedOrdinalsStable(before: ScheduledLiturgy[], after: ScheduledLiturgy[], message = RENUMBER_MESSAGE) {
  for (const b of before) {
    if (!b.hasRecord) continue;
    const a = after.find((x) => x.serviceType === b.serviceType);
    if (!a || a.slot !== b.slot) throw new Error(message);
  }
}

/** True if adding/removing is fine, false if it would renumber a recorded liturgy. */
function isStable(before: ScheduledLiturgy[], after: ScheduledLiturgy[]): boolean {
  try {
    assertRecordedOrdinalsStable(before, after);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

interface LoadedSettings extends WindowSettings {
  scheduleStartDate: string;
}

function intSetting(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

async function loadSettings(): Promise<LoadedSettings> {
  const { rows } = await query<{ key: string; value: string }>(
    `select key, value from app_settings
     where key in ('schedule_start_date', 'checkin_open_before_minutes', 'checkin_close_after_minutes')`
  );
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    scheduleStartDate: m.get("schedule_start_date") ?? FALLBACK_SCHEDULE_START_DATE,
    openBefore: intSetting(m.get("checkin_open_before_minutes"), DEFAULT_OPEN_BEFORE_MINUTES),
    closeAfter: intSetting(m.get("checkin_close_after_minutes"), DEFAULT_CLOSE_AFTER_MINUTES),
  };
}

export async function getCheckinWindowSettings(): Promise<WindowSettings> {
  const { openBefore, closeAfter } = await loadSettings();
  return { openBefore, closeAfter };
}

export async function setCheckinWindowSettings(openBefore: number, closeAfter: number): Promise<void> {
  if (!Number.isInteger(openBefore) || openBefore < 0 || openBefore > 240) {
    throw new Error("Check-in can open between 0 and 240 minutes before a liturgy starts");
  }
  if (!Number.isInteger(closeAfter) || closeAfter < 30 || closeAfter > 720) {
    throw new Error("Check-in can close between 30 and 720 minutes after a liturgy starts");
  }
  await withTransaction(async (client) => {
    for (const [key, value] of [
      ["checkin_open_before_minutes", openBefore],
      ["checkin_close_after_minutes", closeAfter],
    ] as const) {
      await client.query(
        `insert into app_settings (key, value) values ($1, $2)
         on conflict (key) do update set value = excluded.value`,
        [key, String(value)]
      );
    }
  });
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

interface ScheduleContext {
  settings: LoadedSettings;
  startTimes: Map<string, StartTimeMap>;
  extras: { id: string; location_id: string; date: string; start_time: string; starts_evening_before: boolean }[];
  existing: { location_id: string; date: string; service_type: ServiceTypeCode }[];
}

/** Everything needed to build schedules for some churches on some dates, in four batched queries. */
async function loadContext(locationIds: string[], dates: string[]): Promise<ScheduleContext> {
  const [settings, startTimes, extras, existing] = await Promise.all([
    loadSettings(),
    loadStartTimes(locationIds),
    query<{ id: string; location_id: string; date: string; start_time: string; starts_evening_before: boolean }>(
      `select id, location_id, date, start_time, starts_evening_before from extra_liturgies
       where location_id = any($1) and date = any($2::date[])`,
      [locationIds, dates]
    ),
    query<{ location_id: string; date: string; service_type: ServiceTypeCode }>(
      `select location_id, date, service_type from liturgies where location_id = any($1) and date = any($2::date[])`,
      [locationIds, dates]
    ),
  ]);
  return { settings, startTimes, extras: extras.rows, existing: existing.rows };
}

function scheduleFrom(
  ctx: ScheduleContext,
  locationId: string,
  date: string,
  opts: { addExtra?: ExtraInput; removeExtraId?: string } = {}
): ScheduledLiturgy[] {
  const extras: ExtraInput[] = ctx.extras
    .filter((e) => e.location_id === locationId && e.date === date && e.id !== opts.removeExtraId)
    .map((e) => ({ id: e.id, start_time: e.start_time, starts_evening_before: e.starts_evening_before }));
  if (opts.addExtra) extras.push(opts.addExtra);
  return buildSchedule({
    date,
    scheduleStartDate: ctx.settings.scheduleStartDate,
    startTimes: ctx.startTimes.get(locationId) ?? new Map(),
    extras,
    existing: ctx.existing.filter((e) => e.location_id === locationId && e.date === date).map((e) => e.service_type),
  });
}

async function loadOverrides(locationIds: string[], dates: string[]) {
  const { rows } = await query<{ location_id: string; date: string; service_type: ServiceTypeCode; state: OverrideState; set_at: string }>(
    `select location_id, date, service_type, state, set_at from liturgy_lock_overrides
     where location_id = any($1) and date = any($2::date[])`,
    [locationIds, dates]
  );
  const out = new Map<string, Map<string, { state: OverrideState; setAtMs: number }>>(
    locationIds.map((id) => [id, new Map()])
  );
  for (const r of rows) out.get(r.location_id)!.set(`${r.date}|${r.service_type}`, { state: r.state, setAtMs: Date.parse(r.set_at) });
  return out;
}

/** Yesterday, today and tomorrow -- a liturgy that starts the evening before, or whose window runs past midnight, can belong to a neighbouring day. */
function windowDates(today: string): string[] {
  return [addDaysISO(today, -1), today, addDaysISO(today, 1)];
}

// ---------------------------------------------------------------------------
// What pickers (Record a Liturgy, Reports) offer for a date + church
// ---------------------------------------------------------------------------

export interface ScheduleOption {
  serviceType: ServiceTypeCode;
  label: string;
  startTime: string | null;
  startsEveningBefore: boolean;
  isExtra: boolean;
  prefCodes: string[];
}

export async function getScheduleOptions(
  locationId: string,
  date: string
): Promise<{ options: ScheduleOption[]; defaultService: ServiceTypeCode }> {
  const ctx = await loadContext([locationId], [date]);
  const items = scheduleFrom(ctx, locationId, date);
  return {
    options: items.map((it) => ({
      serviceType: it.serviceType,
      label: SERVICE_LABELS[it.serviceType],
      startTime: it.startTime,
      startsEveningBefore: it.startsEveningBefore,
      isExtra: it.isExtra,
      prefCodes: it.prefCodes,
    })),
    defaultService: pickDefaultService(items, date, churchTodayISO(), churchNowMinutes(), ctx.settings),
  };
}

// ---------------------------------------------------------------------------
// Check-in: what is open at a church right now
// ---------------------------------------------------------------------------

export interface OpenLiturgyInfo {
  /** The day the open liturgy counts for (can be tomorrow, for a liturgy that starts the evening before). */
  date: string;
  open: {
    serviceType: ServiceTypeCode;
    startTime: string;
    startsEveningBefore: boolean;
    isSpecialFeast: boolean;
    feastName: string | null;
  } | null;
  /** The next liturgy still to open, for the "nothing open right now" message. */
  next: {
    serviceType: ServiceTypeCode;
    startTime: string;
    startsEveningBefore: boolean;
    opensAt: string;
    opensTomorrow: boolean;
  } | null;
}

async function windowItemsFor(locationIds: string[], today: string) {
  const dates = windowDates(today);
  const [ctx, overrides] = await Promise.all([loadContext(locationIds, dates), loadOverrides(locationIds, dates)]);
  const byLocation = new Map<string, WindowItem[]>();
  for (const id of locationIds) {
    byLocation.set(id, dates.flatMap((d) => toWindowItems(scheduleFrom(ctx, id, d), d, today)));
  }
  return { ctx, overrides, byLocation, dates };
}

export async function getOpenLiturgy(locationId: string): Promise<OpenLiturgyInfo> {
  const today = churchTodayISO();
  const nowAbs = churchNowMinutes();
  const { ctx, overrides, byLocation } = await windowItemsFor([locationId], today);
  const { items, openKey } = computeOpenStatus(byLocation.get(locationId)!, overrides.get(locationId)!, nowAbs, ctx.settings);

  const openItem = openKey ? items.find((i) => i.key === openKey)! : null;
  let openInfo: OpenLiturgyInfo["open"] = null;
  if (openItem) {
    const { rows } = await query<{ is_special_feast: boolean; feast_name: string | null }>(
      `select l.is_special_feast, fn.name as feast_name
       from liturgies l left join feast_names fn on fn.id = l.feast_name_id
       where l.date = $1 and l.location_id = $2 and l.service_type = $3`,
      [openItem.date, locationId, openItem.serviceType]
    );
    openInfo = {
      serviceType: openItem.serviceType,
      startTime: openItem.startTime!,
      startsEveningBefore: openItem.startsEveningBefore,
      isSpecialFeast: Boolean(rows[0]?.is_special_feast),
      feastName: rows[0]?.feast_name ?? null,
    };
  }
  const upcoming = items
    .filter((i) => i.status === "upcoming")
    .sort((a, b) => a.opensAtAbs! - b.opensAtAbs!)[0];
  return {
    date: openItem?.date ?? today,
    open: openInfo,
    next: upcoming
      ? {
          serviceType: upcoming.serviceType,
          startTime: upcoming.startTime!,
          startsEveningBefore: upcoming.startsEveningBefore,
          opensAt: wrapMinutesToHHMM(upcoming.opensAtAbs!),
          opensTomorrow: upcoming.opensAtAbs! >= 1440,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Admin "Check-in windows" page: today at every church
// ---------------------------------------------------------------------------

export interface TodayLiturgy {
  date: string;
  /** Counts for a day other than today (a liturgy that starts tonight for tomorrow, or one still open after midnight for yesterday). */
  forAnotherDay: boolean;
  serviceType: ServiceTypeCode;
  label: string;
  startTime: string | null;
  startsEveningBefore: boolean;
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
  const today = churchTodayISO();
  const nowAbs = churchNowMinutes();
  const { rows: locs } = await query<{ id: string; name: string }>(
    `select id, name from locations where status = 'Active' order by name`
  );
  const ids = locs.map((l) => l.id);
  if (ids.length === 0) return { date: today, locations: [] };

  const { ctx, overrides, byLocation, dates } = await windowItemsFor(ids, today);
  const counts = await query<{ location_id: string; date: string; service_type: ServiceTypeCode; n: string }>(
    `select l.location_id, l.date, l.service_type, count(*) as n
     from liturgies l join participation p on p.liturgy_id = l.id
     where l.date = any($2::date[]) and l.location_id = any($1) and p.activity_id is null
     group by l.location_id, l.date, l.service_type`,
    [ids, dates]
  );

  return {
    date: today,
    locations: locs.map((loc) => {
      const { items } = computeOpenStatus(byLocation.get(loc.id)!, overrides.get(loc.id)!, nowAbs, ctx.settings);
      const shown = items.filter(
        (it) =>
          it.date === today ||
          (it.opensAtAbs !== null && it.closesAtAbs !== null && it.opensAtAbs < 1440 && it.closesAtAbs > 0)
      );
      shown.sort((a, b) => (a.absStart ?? Infinity) - (b.absStart ?? Infinity));
      return {
        locationId: loc.id,
        name: loc.name,
        liturgies: shown.map((it) => ({
          date: it.date,
          forAnotherDay: it.date !== today,
          serviceType: it.serviceType,
          label: SERVICE_LABELS[it.serviceType],
          startTime: it.startTime,
          startsEveningBefore: it.startsEveningBefore,
          isExtra: it.isExtra,
          status: it.status,
          note: it.note,
          override: it.override,
          attendeeCount: Number(
            counts.rows.find((c) => c.location_id === loc.id && c.date === it.date && c.service_type === it.serviceType)?.n ?? 0
          ),
        })),
      };
    }),
  };
}

/** Admin override: force a liturgy open or closed for check-in, or pass null to go back to automatic. */
export async function setLockOverride(
  locationId: string,
  date: string,
  serviceType: ServiceTypeCode,
  state: OverrideState | null,
  userId: string | null
): Promise<void> {
  const today = churchTodayISO();
  const dates = windowDates(today);
  const ctx = await loadContext([locationId], dates);
  const onSchedule = dates.includes(date) && scheduleFrom(ctx, locationId, date).some((i) => i.serviceType === serviceType);
  if (!onSchedule) throw new Error("That liturgy isn't on the current schedule");

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
        `delete from liturgy_lock_overrides
         where location_id = $1 and state = 'open' and date = any($4::date[])
           and not (date = $2 and service_type = $3)`,
        [locationId, date, serviceType, dates]
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
// Regular start times (Check-in windows)
// ---------------------------------------------------------------------------

export interface StartTimeCell {
  weekday: number;
  serviceType: "S1" | "S2";
  time: string;
  /** No admin-saved value yet -- showing the built-in placeholder. */
  isDefault: boolean;
}

/** Sunday has two regular liturgies; every other day has one. */
export async function listStartTimes(locationId: string): Promise<StartTimeCell[]> {
  const saved = (await loadStartTimes([locationId])).get(locationId)!;
  const cells: StartTimeCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (const serviceType of weekday === 0 ? (["S1", "S2"] as const) : (["S1"] as const)) {
      const time = saved.get(`${weekday}-${serviceType}`);
      cells.push({
        weekday,
        serviceType,
        time: time ?? defaultRegularStartTime(weekday, serviceType)!,
        isDefault: time === undefined,
      });
    }
  }
  return cells;
}

export async function setStartTimesForDay(
  locationId: string,
  weekday: number,
  times: { S1: string; S2?: string }
): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Invalid day");
  if (!isValidTime(times.S1)) throw new Error("Enter a valid time for the 1st Liturgy");
  const writes: [ServiceTypeCode, string][] = [["S1", times.S1]];
  if (weekday === 0) {
    if (!times.S2 || !isValidTime(times.S2)) throw new Error("Enter a valid time for the 2nd Liturgy");
    if (!(times.S1 < times.S2)) throw new Error("The 2nd Liturgy has to start later than the 1st");
    writes.push(["S2", times.S2]);
  }
  await withTransaction(async (client) => {
    for (const [s, t] of writes) {
      await client.query(
        `insert into liturgy_start_times (location_id, weekday, service_type, start_time) values ($1, $2, $3, $4)
         on conflict (location_id, weekday, service_type) do update set start_time = excluded.start_time`,
        [locationId, weekday, s, t]
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
  /** Its position in that day's order (1st/2nd/3rd) -- worked out, not stored. */
  serviceType: ServiceTypeCode;
  startTime: string;
  startsEveningBefore: boolean;
  seriesId: string | null;
  hasRecord: boolean;
}

function assertNotPast(date: string) {
  if (date < churchTodayISO()) throw new Error("Extra liturgies can only be added for today or a later date");
}

function assertStartTime(startTime: string) {
  if (!isValidTime(startTime)) throw new Error("Enter the time the liturgy starts");
}

/** Adds one extra liturgy to a church on a date. It gets its own start time, and its position (1st/2nd/3rd) follows from the day's order. */
export async function addExtraLiturgy(
  locationId: string,
  date: string,
  startTime: string,
  startsEveningBefore: boolean,
  createdBy: string | null
): Promise<{ extraId: string; serviceType: ServiceTypeCode }> {
  assertNotPast(date);
  assertStartTime(startTime);
  if (startsEveningBefore && date === churchTodayISO()) {
    throw new Error("A liturgy that starts the evening before today would already have started");
  }
  const { rows: loc } = await query<{ id: string }>(`select id from locations where id = $1 and status = 'Active'`, [locationId]);
  if (loc.length === 0) throw new Error("Choose an active church");

  const ctx = await loadContext([locationId], [date]);
  const before = scheduleFrom(ctx, locationId, date);
  if (before.length >= MAX_LITURGIES_PER_DAY) {
    throw new Error("That church already has 3 liturgies on that day, which is the most the app allows");
  }
  const after = scheduleFrom(ctx, locationId, date, {
    addExtra: { id: "new", start_time: startTime, starts_evening_before: startsEveningBefore },
  });
  assertRecordedOrdinalsStable(before, after);

  let extraId: string;
  try {
    const { rows } = await query<{ id: string }>(
      `insert into extra_liturgies (location_id, date, start_time, starts_evening_before, created_by)
       values ($1, $2, $3, $4, $5) returning id`,
      [locationId, date, startTime, startsEveningBefore, createdBy]
    );
    extraId = rows[0].id;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new Error("That church already has an extra liturgy at that time on that day");
    }
    throw err;
  }
  const serviceType = after.find((i) => i.slot === "x:new")!.serviceType;
  return { extraId, serviceType };
}

export interface RecurringInput {
  locationIds: string[];
  weekdays: number[];
  from: string;
  to: string;
  startTime: string;
  startsEveningBefore: boolean;
}

export interface RecurringPlan {
  planned: { locationId: string; date: string }[];
  skippedHasExtra: number;
  skippedFull: number;
  skippedRecorded: number;
}

const MAX_SERIES_DAYS = 400;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** What a repeating add would do, without writing anything. Days that already have an extra at that church are skipped, so running it twice never doubles up. */
export async function planRecurringExtras(input: RecurringInput): Promise<RecurringPlan> {
  const { locationIds, weekdays, from, to, startTime, startsEveningBefore } = input;
  if (locationIds.length === 0) throw new Error("Choose at least one church");
  if (weekdays.length === 0 || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("Choose at least one day of the week");
  }
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new Error("Enter a start and end date");
  if (to < from) throw new Error("The end date is before the start date");
  assertNotPast(from);
  assertStartTime(startTime);
  if (startsEveningBefore && from <= churchTodayISO()) {
    throw new Error("A liturgy that starts the evening before can only be repeated from tomorrow onward");
  }

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    if (dates.length > MAX_SERIES_DAYS) throw new Error(`Please keep a repeating series to ${MAX_SERIES_DAYS} days or fewer`);
    if (weekdays.includes(weekdayOfDateString(d))) dates.push(d);
  }

  const uniqueLocations = [...new Set(locationIds)];
  const { rows: locs } = await query<{ id: string }>(
    `select id from locations where id = any($1) and status = 'Active'`,
    [uniqueLocations]
  );
  if (locs.length !== uniqueLocations.length) throw new Error("One of the chosen churches isn't active");

  const ctx = dates.length ? await loadContext(uniqueLocations, dates) : null;
  const plan: RecurringPlan = { planned: [], skippedHasExtra: 0, skippedFull: 0, skippedRecorded: 0 };
  if (!ctx) return plan;
  for (const locationId of uniqueLocations) {
    for (const date of dates) {
      if (ctx.extras.some((e) => e.location_id === locationId && e.date === date)) {
        plan.skippedHasExtra++;
        continue;
      }
      const before = scheduleFrom(ctx, locationId, date);
      if (before.length >= MAX_LITURGIES_PER_DAY) {
        plan.skippedFull++;
        continue;
      }
      const after = scheduleFrom(ctx, locationId, date, {
        addExtra: { id: "new", start_time: startTime, starts_evening_before: startsEveningBefore },
      });
      if (!isStable(before, after)) {
        plan.skippedRecorded++;
        continue;
      }
      plan.planned.push({ locationId, date });
    }
  }
  return plan;
}

export async function addRecurringExtras(
  input: RecurringInput,
  createdBy: string | null
): Promise<{ created: number; skippedHasExtra: number; skippedFull: number; skippedRecorded: number }> {
  const plan = await planRecurringExtras(input);
  const { skippedHasExtra, skippedFull, skippedRecorded } = plan;
  if (plan.planned.length === 0) return { created: 0, skippedHasExtra, skippedFull, skippedRecorded };
  const seriesId = crypto.randomUUID();
  const { rowCount } = await query(
    `insert into extra_liturgies (location_id, date, start_time, starts_evening_before, series_id, created_by)
     select loc, d::date, $3, $4, $5::uuid, $6::uuid
     from unnest($1::uuid[], $2::text[]) as t(loc, d)
     on conflict (location_id, date, starts_evening_before, start_time) do nothing`,
    [
      plan.planned.map((p) => p.locationId),
      plan.planned.map((p) => p.date),
      input.startTime,
      input.startsEveningBefore,
      seriesId,
      createdBy,
    ]
  );
  return { created: rowCount ?? 0, skippedHasExtra, skippedFull, skippedRecorded };
}

interface ExtraDbRow {
  id: string;
  location_id: string;
  location_name: string;
  date: string;
  start_time: string;
  starts_evening_before: boolean;
  series_id: string | null;
}

const EXTRA_SELECT = `select e.id, e.location_id, loc.name as location_name, e.date, e.start_time,
                             e.starts_evening_before, e.series_id
                      from extra_liturgies e join locations loc on loc.id = e.location_id`;

export async function listUpcomingExtras(): Promise<ExtraRow[]> {
  const { rows } = await query<ExtraDbRow>(`${EXTRA_SELECT} where e.date >= $1 order by e.date, loc.name, e.start_time`, [churchTodayISO()]);
  if (rows.length === 0) return [];
  const ctx = await loadContext([...new Set(rows.map((r) => r.location_id))], [...new Set(rows.map((r) => r.date))]);
  return rows.map((r) => {
    const item = scheduleFrom(ctx, r.location_id, r.date).find((i) => i.slot === `x:${r.id}`);
    return {
      id: r.id,
      locationId: r.location_id,
      locationName: r.location_name,
      date: r.date,
      serviceType: item?.serviceType ?? "S2",
      startTime: r.start_time,
      startsEveningBefore: r.starts_evening_before,
      seriesId: r.series_id,
      hasRecord: item?.hasRecord ?? false,
    };
  });
}

export async function removeExtra(id: string): Promise<void> {
  const { rows } = await query<ExtraDbRow>(`${EXTRA_SELECT} where e.id = $1`, [id]);
  if (rows.length === 0) return;
  const r = rows[0];
  const ctx = await loadContext([r.location_id], [r.date]);
  const before = scheduleFrom(ctx, r.location_id, r.date);
  const mine = before.find((i) => i.slot === `x:${id}`);
  if (mine?.hasRecord) throw new Error("That liturgy already has attendance recorded, so it can't be removed");
  assertRecordedOrdinalsStable(before, scheduleFrom(ctx, r.location_id, r.date, { removeExtraId: id }));
  await query(`delete from extra_liturgies where id = $1`, [id]);
}

/** Removes every upcoming date in a series that can go (no attendance on it, and removing it wouldn't renumber a recorded liturgy); returns how many were removed and how many kept. */
export async function removeExtraSeries(seriesId: string): Promise<{ removed: number; kept: number }> {
  const { rows } = await query<ExtraDbRow>(`${EXTRA_SELECT} where e.series_id = $1 and e.date >= $2`, [seriesId, churchTodayISO()]);
  if (rows.length === 0) return { removed: 0, kept: 0 };
  const ctx = await loadContext([...new Set(rows.map((r) => r.location_id))], [...new Set(rows.map((r) => r.date))]);
  const removable: string[] = [];
  for (const r of rows) {
    const before = scheduleFrom(ctx, r.location_id, r.date);
    if (before.find((i) => i.slot === `x:${r.id}`)?.hasRecord) continue;
    if (isStable(before, scheduleFrom(ctx, r.location_id, r.date, { removeExtraId: r.id }))) removable.push(r.id);
  }
  if (removable.length) await query(`delete from extra_liturgies where id = any($1::uuid[])`, [removable]);
  return { removed: removable.length, kept: rows.length - removable.length };
}
