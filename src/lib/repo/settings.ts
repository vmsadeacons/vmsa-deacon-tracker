import { query } from "@/lib/db";

export interface AppSettings {
  ageGroupYouthMin: number;
  ageGroupAdultMin: number;
  suggestionWindowMonths: number;
  suggestionMinAttendance: number;
}

const DEFAULTS: AppSettings = {
  ageGroupYouthMin: 18,
  ageGroupAdultMin: 35,
  suggestionWindowMonths: 3,
  suggestionMinAttendance: 3,
};

/** Single round trip — call once per request and pass the result down, never per-row. */
export async function getAppSettings(): Promise<AppSettings> {
  const { rows } = await query<{ key: string; value: string }>(
    `select key, value from app_settings`
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ageGroupYouthMin: Number(map.age_group_youth_min ?? DEFAULTS.ageGroupYouthMin),
    ageGroupAdultMin: Number(map.age_group_adult_min ?? DEFAULTS.ageGroupAdultMin),
    suggestionWindowMonths: Number(map.suggestion_window_months ?? DEFAULTS.suggestionWindowMonths),
    suggestionMinAttendance: Number(map.suggestion_min_attendance ?? DEFAULTS.suggestionMinAttendance),
  };
}

async function upsertSetting(key: string, value: string) {
  await query(
    `insert into app_settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [key, value]
  );
}

export async function setAgeGroupThresholds(youthMin: number, adultMin: number) {
  if (!(youthMin >= 0 && adultMin >= 0 && youthMin < adultMin)) {
    throw new Error("Youth threshold must be non-negative and less than the Adult threshold");
  }
  await upsertSetting("age_group_youth_min", String(youthMin));
  await upsertSetting("age_group_adult_min", String(adultMin));
}

export async function setSuggestionSettings(windowMonths: number, minAttendance: number) {
  if (!(Number.isInteger(windowMonths) && windowMonths >= 1)) {
    throw new Error("Rolling window must be at least 1 month");
  }
  if (!(Number.isInteger(minAttendance) && minAttendance >= 1)) {
    throw new Error("Minimum attendance must be at least 1");
  }
  await upsertSetting("suggestion_window_months", String(windowMonths));
  await upsertSetting("suggestion_min_attendance", String(minAttendance));
}
