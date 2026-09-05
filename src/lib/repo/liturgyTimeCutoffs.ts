import { query } from "@/lib/db";
import { churchTodayISO, churchNowTimeString, weekdayOfDateString } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";

// weekday 0-6 = Sun..Sat; 7 = the Special Feast override, which applies
// regardless of weekday whenever the liturgy being predicted is flagged a
// special feast -- mirrors is_special_feast being an orthogonal flag on the
// liturgy itself, not tied to any particular day.
export const FEAST_CUTOFF_KEY = 7;

const DEFAULT_CUTOFF_TIME = "12:00";

export interface CutoffRow {
  weekday: number;
  cutoffTime: string;
}

/** All 8 rows (Sun..Sat + Special Feast) for one location, in order -- rows with no admin override are filled in with the default so the Settings UI always has exactly 8 to render. */
export async function listCutoffsForLocation(locationId: string): Promise<CutoffRow[]> {
  const { rows } = await query<{ weekday: number; cutoff_time: string }>(
    `select weekday, cutoff_time from liturgy_time_cutoffs where location_id = $1`,
    [locationId]
  );
  const byWeekday = new Map(rows.map((r) => [r.weekday, r.cutoff_time]));
  return Array.from({ length: 8 }, (_, weekday) => ({
    weekday,
    cutoffTime: byWeekday.get(weekday) ?? DEFAULT_CUTOFF_TIME,
  }));
}

export async function setCutoff(locationId: string, weekday: number, cutoffTime: string): Promise<void> {
  await query(
    `insert into liturgy_time_cutoffs (location_id, weekday, cutoff_time)
     values ($1, $2, $3)
     on conflict (location_id, weekday) do update set cutoff_time = excluded.cutoff_time`,
    [locationId, weekday, cutoffTime]
  );
}

async function getCutoffTime(locationId: string, key: number): Promise<string> {
  const { rows } = await query<{ cutoff_time: string }>(
    `select cutoff_time from liturgy_time_cutoffs where location_id = $1 and weekday = $2`,
    [locationId, key]
  );
  return rows[0]?.cutoff_time ?? DEFAULT_CUTOFF_TIME;
}

/**
 * Predicts 1st vs 2nd liturgy for "right now" at a given location, using
 * the admin-configured per-weekday cutoff (or the Special Feast override
 * when isSpecialFeast is true) -- generalizes the old Sunday-only 9am
 * split (see computeDefaultServiceType) to every day, every location, and
 * feast days.
 */
export async function predictServiceType(
  locationId: string,
  dateStr: string,
  isSpecialFeast: boolean
): Promise<ServiceTypeCode> {
  if (dateStr !== churchTodayISO()) return "S2"; // no "current time" to anchor a non-today date to
  const key = isSpecialFeast ? FEAST_CUTOFF_KEY : weekdayOfDateString(dateStr);
  const cutoff = await getCutoffTime(locationId, key);
  return churchNowTimeString() < cutoff ? "S1" : "S2";
}
