"use server";

import { assertSession } from "@/lib/authz";
import { findLiturgyContext, getLiturgyContext, checkInSelf, undoCheckInSelf } from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import { churchTodayISO } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";

/**
 * Self check-in is only ever allowed for today -- enforced here, not just
 * by the UI locking the date field, so it can't be bypassed by calling the
 * action directly with a different date.
 */
function assertIsToday(date: string) {
  if (date !== churchTodayISO()) {
    throw new Error("You can only check in for today");
  }
}

/** Read-only -- never creates a liturgy row just from viewing a date. */
export async function openCheckinLiturgyAction(
  date: string,
  locationId: string,
  serviceType: ServiceTypeCode
) {
  const session = await assertSession();
  const { liturgyId, context } = await findLiturgyContext(date, locationId, serviceType);
  await setStickyLocation(session.user.id, "checkin", locationId);
  return { liturgyId, context };
}

export async function refreshCheckinAction(liturgyId: string) {
  await assertSession();
  return getLiturgyContext(liturgyId);
}

export async function checkInSelfAction(date: string, locationId: string, serviceType: ServiceTypeCode) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  assertIsToday(date);
  return checkInSelf(date, locationId, serviceType, session.user.linkedDeaconId);
}

export async function undoCheckInSelfAction(date: string, locationId: string, serviceType: ServiceTypeCode) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  assertIsToday(date);
  return undoCheckInSelf(date, locationId, serviceType, session.user.linkedDeaconId);
}
