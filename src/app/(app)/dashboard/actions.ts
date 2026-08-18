"use server";

import { assertAdmin } from "@/lib/authz";
import { getAbsentDeaconsForPeriod, isValidAbsencePeriod, type AbsencePeriodUnit } from "@/lib/repo/dashboard";

/**
 * Recomputes the "Absent" tile's list for whatever period the viewer picks
 * in the dropdown. This is a personal view filter, not a persisted setting
 * -- open to any admin, nothing is written to the database.
 */
export async function getAbsentDeaconsAction(value: number, unit: AbsencePeriodUnit) {
  await assertAdmin();
  if (!isValidAbsencePeriod(value, unit)) {
    throw new Error(`${value} ${unit} isn't one of the offered options`);
  }
  return getAbsentDeaconsForPeriod(value, unit);
}
