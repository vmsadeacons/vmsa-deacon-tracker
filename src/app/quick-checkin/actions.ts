"use server";

// No auth check anywhere in this file, on purpose -- this is the public,
// no-login Quick Check-in form. Identity comes from a name picked once
// during setup (kept in the browser's own localStorage, never sent here
// except as a plain deaconId). Where the phone is comes from the position it
// sends, which the server checks against each church's area at submit time;
// a check-in it can't place inside the church is still recorded but flagged
// for the admins -- it is never trusted blindly, and never blocked.

import { after } from "next/server";
import { searchDeaconsByName } from "@/lib/repo/publicProfile";
import {
  resolveCheckinLocations,
  getCheckinOpenLiturgy,
  submitQuickCheckin,
  listActiveLocationsForCheckin,
  resolveQrToken,
  type GpsFix,
  type CheckinSelection,
} from "@/lib/repo/quickCheckin";
import { notifyFlag } from "@/lib/push";

export async function searchDeaconsByNameAction(firstName: string, lastName: string) {
  return searchDeaconsByName(firstName, lastName);
}

export async function resolveCheckinLocationsAction(lat: number, lng: number, accuracyMeters: number) {
  return resolveCheckinLocations(lat, lng, accuracyMeters);
}

export async function listActiveLocationsForCheckinAction() {
  return listActiveLocationsForCheckin();
}

export async function getCheckinOpenLiturgyAction(locationId: string) {
  return getCheckinOpenLiturgy(locationId);
}

export async function submitQuickCheckinAction(
  deaconId: string,
  locationId: string,
  selection: Exclude<CheckinSelection, "qr">,
  fix: GpsFix | null
) {
  try {
    const result = await submitQuickCheckin({
      deaconId,
      locationId,
      method: "agios",
      selection: selection === "selected" ? "selected" : "detected",
      fix,
    });
    if (result.ok && result.flagId) {
      const flagId = result.flagId;
      after(() => notifyFlag(flagId));
    }
    return result;
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Check-in failed" };
  }
}

/** A scanned QR code's secret -> the church it belongs to (or null for an old or made-up code). */
export async function resolveQrTokenAction(token: string) {
  return resolveQrToken(token);
}

export async function submitQrCheckinAction(token: string, deaconId: string, fix: GpsFix | null) {
  try {
    const church = await resolveQrToken(token);
    if (!church) return { ok: false as const, error: "This QR code is no longer valid. Please scan the current one at the church." };
    const result = await submitQuickCheckin({
      deaconId,
      locationId: church.id,
      method: "qr",
      selection: "qr",
      fix,
    });
    if (result.ok && result.flagId) {
      const flagId = result.flagId;
      after(() => notifyFlag(flagId));
    }
    return result;
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Check-in failed" };
  }
}
