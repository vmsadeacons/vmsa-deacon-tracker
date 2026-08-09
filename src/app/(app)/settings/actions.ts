"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { createLocation, updateLocation } from "@/lib/repo/locations";
import { createActivity, updateActivity } from "@/lib/repo/activities";
import { setAbsencePeriod, setAgeGroupThresholds } from "@/lib/repo/settings";

export async function createLocationAction(name: string) {
  await assertAdmin();
  const location = await createLocation(name);
  revalidatePath("/settings");
  return { ok: true as const, location };
}

export async function updateLocationAction(
  id: string,
  patch: { name?: string; status?: "Active" | "Inactive" }
) {
  await assertAdmin();
  const location = await updateLocation(id, patch);
  revalidatePath("/settings");
  return { ok: true as const, location };
}

export async function createActivityAction(name: string, allowsMultiple: boolean) {
  await assertAdmin();
  const activity = await createActivity(name, allowsMultiple);
  revalidatePath("/settings");
  return { ok: true as const, activity };
}

export async function updateActivityAction(
  id: string,
  patch: { name?: string; allowsMultiple?: boolean; status?: "Active" | "Inactive" }
) {
  await assertAdmin();
  const activity = await updateActivity(id, patch);
  revalidatePath("/settings");
  return { ok: true as const, activity };
}

export async function setAbsencePeriodAction(months: 1 | 2 | 3 | 6) {
  await assertAdmin();
  await setAbsencePeriod(months);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function setAgeGroupThresholdsAction(youthMin: number, adultMin: number) {
  await assertAdmin();
  try {
    await setAgeGroupThresholds(youthMin, adultMin);
    revalidatePath("/settings");
    revalidatePath("/deacons");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
