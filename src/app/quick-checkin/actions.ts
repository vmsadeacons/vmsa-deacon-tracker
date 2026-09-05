"use server";

// No auth check anywhere in this file, on purpose -- this is the public,
// no-login Quick Check-in form. Identity comes from a name picked once
// during setup (kept in the browser's own localStorage, never sent here
// except as a plain deaconId), and location comes from geolocation checked
// against each church's configured geofence -- never trusted from the
// client without that check.

import { searchDeaconsByName } from "@/lib/repo/publicProfile";
import {
  resolveCheckinLocations,
  getCheckinPrediction,
  submitQuickCheckin,
  listActiveLocationsForCheckin,
} from "@/lib/repo/quickCheckin";
import type { ServiceTypeCode } from "@/lib/constants";

export async function searchDeaconsByNameAction(firstName: string, lastName: string) {
  return searchDeaconsByName(firstName, lastName);
}

export async function resolveCheckinLocationsAction(lat: number, lng: number, accuracyMeters: number) {
  return resolveCheckinLocations(lat, lng, accuracyMeters);
}

export async function listActiveLocationsForCheckinAction() {
  return listActiveLocationsForCheckin();
}

export async function getCheckinPredictionAction(locationId: string) {
  return getCheckinPrediction(locationId);
}

export async function submitQuickCheckinAction(deaconId: string, locationId: string, serviceType: ServiceTypeCode) {
  try {
    await submitQuickCheckin(deaconId, locationId, serviceType);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Check-in failed" };
  }
}
