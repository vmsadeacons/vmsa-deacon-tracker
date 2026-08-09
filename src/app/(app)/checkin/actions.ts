"use server";

import { assertSession } from "@/lib/authz";
import { getOrCreateLiturgy, getLiturgyContext, checkInSelf, undoCheckInSelf } from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import type { ServiceTypeCode } from "@/lib/constants";

export async function openCheckinLiturgyAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode
) {
  const session = await assertSession();
  const liturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
  await setStickyLocation(session.user.id, "checkin", locationId);
  const context = await getLiturgyContext(liturgyId);
  return { liturgyId, context };
}

export async function refreshCheckinAction(liturgyId: string) {
  await assertSession();
  return getLiturgyContext(liturgyId);
}

export async function checkInSelfAction(liturgyId: string) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  return checkInSelf(liturgyId, session.user.linkedDeaconId);
}

export async function undoCheckInSelfAction(liturgyId: string) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  return undoCheckInSelf(liturgyId, session.user.linkedDeaconId);
}
