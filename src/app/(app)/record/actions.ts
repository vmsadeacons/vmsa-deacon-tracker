"use server";

import { assertAdmin } from "@/lib/authz";
import {
  getOrCreateLiturgy,
  getLiturgyContext,
  toggleAttendance,
  toggleMultiActivityAssignment,
  setSingleActivityAssignment,
} from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import type { ServiceTypeCode } from "@/lib/constants";

export async function openLiturgyAction(date: string, locationId: string, serviceType: ServiceTypeCode) {
  const session = await assertAdmin();
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await setStickyLocation(session.user.id, "record", locationId);
  const context = await getLiturgyContext(liturgyId);
  return { liturgyId, context };
}

export async function refreshLiturgyAction(liturgyId: string) {
  await assertAdmin();
  return getLiturgyContext(liturgyId);
}

export async function toggleAttendanceAction(liturgyId: string, deaconId: string) {
  await assertAdmin();
  return toggleAttendance(liturgyId, deaconId, "admin");
}

export async function toggleAltarAction(liturgyId: string, activityId: string, deaconId: string) {
  await assertAdmin();
  return toggleMultiActivityAssignment(liturgyId, activityId, deaconId, "admin");
}

export async function setReadingAction(liturgyId: string, activityId: string, deaconId: string | null) {
  await assertAdmin();
  return setSingleActivityAssignment(liturgyId, activityId, deaconId, "admin");
}
