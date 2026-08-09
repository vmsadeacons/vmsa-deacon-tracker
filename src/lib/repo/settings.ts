import { query } from "@/lib/db";

export interface AppSettings {
  absencePeriodMonths: number;
  ageGroupYouthMin: number;
  ageGroupAdultMin: number;
}

const DEFAULTS: AppSettings = {
  absencePeriodMonths: 1,
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
    absencePeriodMonths: Number(map.absence_period_months ?? DEFAULTS.absencePeriodMonths),
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

export async function setAbsencePeriod(months: 1 | 2 | 3 | 6) {
  await upsertSetting("absence_period_months", String(months));
}

export async function setAgeGroupThresholds(youthMin: number, adultMin: number) {
  if (!(youthMin >= 0 && adultMin >= 0 && youthMin < adultMin)) {
    throw new Error("Youth threshold must be non-negative and less than the Adult threshold");
  }
  await upsertSetting("age_group_youth_min", String(youthMin));
  await upsertSetting("age_group_adult_min", String(adultMin));
}
