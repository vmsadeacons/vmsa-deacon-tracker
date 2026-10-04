"use server";

import { revalidatePath } from "next/cache";
import { assertSystemAdmin } from "@/lib/authz";
import { createLocation, updateLocation, setLocationGeofence } from "@/lib/repo/locations";
import { setCutoff } from "@/lib/repo/liturgyTimeCutoffs";
import { createActivity, updateActivity } from "@/lib/repo/activities";
import { setAgeGroupThresholds, setSuggestionSettings } from "@/lib/repo/settings";
import { updatePWActivity } from "@/lib/repo/passionWeekActivities";
import { createRank, updateRank } from "@/lib/repo/ranks";
import { createFeastName, updateFeastName } from "@/lib/repo/feastNames";
import {
  createDayFilterOption,
  updateDayFilterOption,
  deleteDayFilterOption,
} from "@/lib/repo/dayFilterOptions";
import {
  getMergePreview,
  mergeDeacons,
  listMergeLog,
  detectDuplicateCandidates,
  dismissDuplicatePair,
  type MergeFieldPatch,
} from "@/lib/repo/mergeDeacons";
import type { PWActivityId } from "@/lib/constants";

// Settings is view-only for General Admins — every mutation here is
// SystemAdmin-only (the page itself still renders for General Admins,
// they just can't submit any of these).

export async function createLocationAction(name: string) {
  await assertSystemAdmin();
  const location = await createLocation(name);
  revalidatePath("/settings");
  return { ok: true as const, location };
}

export async function updateLocationAction(
  id: string,
  patch: { name?: string; status?: "Active" | "Inactive" }
) {
  await assertSystemAdmin();
  const location = await updateLocation(id, patch);
  revalidatePath("/settings");
  return { ok: true as const, location };
}

export async function setLocationGeofenceAction(
  id: string,
  latitude: number | null,
  longitude: number | null,
  geofenceRadiusFt: number | null
) {
  await assertSystemAdmin();
  try {
    const location = await setLocationGeofence(id, latitude, longitude, geofenceRadiusFt);
    revalidatePath("/settings");
    return { ok: true as const, location };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setCutoffAction(locationId: string, weekday: number, cutoffTime: string) {
  await assertSystemAdmin();
  try {
    await setCutoff(locationId, weekday, cutoffTime);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function createActivityAction(name: string, allowsMultiple: boolean) {
  await assertSystemAdmin();
  const activity = await createActivity(name, allowsMultiple);
  revalidatePath("/settings");
  return { ok: true as const, activity };
}

export async function updateActivityAction(
  id: string,
  patch: { name?: string; allowsMultiple?: boolean; status?: "Active" | "Inactive"; sortOrder?: number }
) {
  await assertSystemAdmin();
  const activity = await updateActivity(id, patch);
  revalidatePath("/settings");
  return { ok: true as const, activity };
}

export async function setAgeGroupThresholdsAction(youthMin: number, adultMin: number) {
  await assertSystemAdmin();
  try {
    await setAgeGroupThresholds(youthMin, adultMin);
    revalidatePath("/settings");
    revalidatePath("/deacons");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setSuggestionSettingsAction(windowMonths: number, minAttendance: number) {
  await assertSystemAdmin();
  try {
    await setSuggestionSettings(windowMonths, minAttendance);
    revalidatePath("/settings");
    revalidatePath("/record");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updatePWActivityAction(
  code: PWActivityId,
  patch: { label?: string; sortOrder?: number; status?: "Active" | "Inactive" }
) {
  await assertSystemAdmin();
  await updatePWActivity(code, patch);
  revalidatePath("/settings");
  revalidatePath("/passion-week");
  revalidatePath("/reports");
  revalidatePath("/history");
  return { ok: true as const };
}

export async function createRankAction(name: string) {
  await assertSystemAdmin();
  const rank = await createRank(name);
  revalidatePath("/settings");
  return { ok: true as const, rank };
}

export async function updateRankAction(
  id: string,
  patch: { name?: string; sortOrder?: number; status?: "Active" | "Inactive" }
) {
  await assertSystemAdmin();
  const rank = await updateRank(id, patch);
  revalidatePath("/settings");
  revalidatePath("/deacons");
  return { ok: true as const, rank };
}

export async function createDayFilterOptionAction(
  label: string,
  weekdays: number[],
  isSpecialFeast: boolean
) {
  await assertSystemAdmin();
  try {
    const option = await createDayFilterOption(label, weekdays, isSpecialFeast);
    revalidatePath("/settings");
    revalidatePath("/reports");
    return { ok: true as const, option };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateDayFilterOptionAction(
  id: string,
  patch: { label?: string; weekdays?: number[]; isSpecialFeast?: boolean; sortOrder?: number }
) {
  await assertSystemAdmin();
  try {
    const option = await updateDayFilterOption(id, patch);
    revalidatePath("/settings");
    revalidatePath("/reports");
    return { ok: true as const, option };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteDayFilterOptionAction(id: string) {
  await assertSystemAdmin();
  await deleteDayFilterOption(id);
  revalidatePath("/settings");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function createFeastNameAction(name: string) {
  await assertSystemAdmin();
  try {
    const feastName = await createFeastName(name);
    revalidatePath("/settings");
    revalidatePath("/record");
    return { ok: true as const, feastName };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function getMergePreviewAction(idA: string, idB: string) {
  await assertSystemAdmin();
  const preview = await getMergePreview(idA, idB);
  if (!preview) return { ok: false as const, error: "One of these records no longer exists — refresh and try again." };
  return { ok: true as const, preview };
}

export async function mergeDeaconsAction(survivorId: string, mergedId: string, patch: MergeFieldPatch) {
  const session = await assertSystemAdmin();
  try {
    const result = await mergeDeacons(survivorId, mergedId, patch, session.user.email!);
    revalidatePath("/settings");
    revalidatePath("/deacons");
    revalidatePath("/history");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    revalidatePath("/member-updates");
    revalidatePath("/access");
    return { ok: true as const, result };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function listMergeLogAction() {
  await assertSystemAdmin();
  return listMergeLog();
}

export async function detectDuplicateCandidatesAction() {
  await assertSystemAdmin();
  return detectDuplicateCandidates();
}

export async function dismissDuplicatePairAction(idA: string, idB: string) {
  const session = await assertSystemAdmin();
  try {
    await dismissDuplicatePair(idA, idB, session.user.email!);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateFeastNameAction(
  id: string,
  patch: { name?: string; sortOrder?: number; status?: "Active" | "Inactive" }
) {
  await assertSystemAdmin();
  try {
    const feastName = await updateFeastName(id, patch);
    revalidatePath("/settings");
    revalidatePath("/record");
    revalidatePath("/reports");
    revalidatePath("/history");
    return { ok: true as const, feastName };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
