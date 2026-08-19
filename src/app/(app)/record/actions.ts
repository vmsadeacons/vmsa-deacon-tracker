"use server";

import { assertAdmin } from "@/lib/authz";
import {
  findLiturgyContext,
  getLiturgyContext,
  toggleAttendance,
  toggleMultiActivityAssignment,
  setSingleActivityAssignment,
  setSpecialFeast,
} from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import type { ServiceTypeCode } from "@/lib/constants";

/** Read-only -- never creates a liturgy row just from viewing a date. */
export async function openLiturgyAction(date: string, locationId: string, serviceType: ServiceTypeCode) {
  const session = await assertAdmin();
  const { liturgyId, context } = await findLiturgyContext(date, locationId, serviceType);
  await setStickyLocation(session.user.id, "record", locationId);
  return { liturgyId, context };
}

export async function refreshLiturgyAction(liturgyId: string) {
  await assertAdmin();
  return getLiturgyContext(liturgyId);
}

export async function toggleAttendanceAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  deaconId: string
) {
  await assertAdmin();
  return toggleAttendance(date, locationId, serviceType, deaconId, "admin");
}

export async function toggleAltarAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  activityId: string,
  deaconId: string
) {
  await assertAdmin();
  return toggleMultiActivityAssignment(date, locationId, serviceType, activityId, deaconId, "admin");
}

export async function setReadingAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  activityId: string,
  deaconId: string | null
) {
  await assertAdmin();
  return setSingleActivityAssignment(date, locationId, serviceType, activityId, deaconId, "admin");
}

export async function setSpecialFeastAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode,
  isSpecialFeast: boolean,
  feastName: string | null
) {
  await assertAdmin();
  try {
    const context = await setSpecialFeast(date, locationId, serviceType, isSpecialFeast, feastName);
    return { ok: true as const, context };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
