import { query } from "@/lib/db";

export type AbsencePeriodUnit = "weeks" | "months";

export interface AppSettings {
  absencePeriodValue: number;
  absencePeriodUnit: AbsencePeriodUnit;
  ageGroupYouthMin: number;
  ageGroupAdultMin: number;
}

const DEFAULTS: AppSettings = {
  absencePeriodValue: 1,
  absencePeriodUnit: "months",
  ageGroupYouthMin: 18,
  ageGroupAdultMin: 35,
};

/** Single round trip — call once per request and pass the result down, never per-row. */
export async function getAppSettings(): Promise<AppSettings> {
  const { rows } = await query<{ key: string; value: string }>(
    `select key, value from app_settings`
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    absencePeriodValue: Number(map.absence_period_value ?? DEFAULTS.absencePeriodValue),
    absencePeriodUnit: (map.absence_period_unit as AbsencePeriodUnit) ?? DEFAULTS.absencePeriodUnit,
    ageGroupYouthMin: Number(map.age_group_youth_min ?? DEFAULTS.ageGroupYouthMin),
    ageGroupAdultMin: Number(map.age_group_adult_min ?? DEFAULTS.ageGroupAdultMin),
  };
}

async function upsertSetting(key: string, value: string) {
  await query(
    `insert into app_settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [key, value]
  );
}

const ALLOWED_WEEK_VALUES = [1, 2, 3];
const ALLOWED_MONTH_VALUES = [1, 2, 3, 6];

export async function setAbsencePeriod(value: number, unit: AbsencePeriodUnit) {
  const allowed = unit === "weeks" ? ALLOWED_WEEK_VALUES : ALLOWED_MONTH_VALUES;
  if (!allowed.includes(value)) {
    throw new Error(`${value} ${unit} isn't one of the offered options`);
  }
  await upsertSetting("absence_period_value", String(value));
  await upsertSetting("absence_period_unit", unit);
}

export async function setAgeGroupThresholds(youthMin: number, adultMin: number) {
  if (!(youthMin >= 0 && adultMin >= 0 && youthMin < adultMin)) {
    throw new Error("Youth threshold must be non-negative and less than the Adult threshold");
  }
  await upsertSetting("age_group_youth_min", String(youthMin));
  await upsertSetting("age_group_adult_min", String(adultMin));
}
