"use server";

// No auth check anywhere in this file, on purpose -- this is the public,
// no-login self-service profile form. See src/lib/repo/publicProfile.ts for
// what that surface deliberately does and doesn't expose.

import {
  searchDeaconsByName,
  getPublicDeaconMeta,
  createDeaconPublic,
  resolveProfileUpdate,
  type PublicProfileInput,
} from "@/lib/repo/publicProfile";
import { setDeaconPhoto, deleteDeaconPhoto } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import { listRanks } from "@/lib/repo/ranks";
import { getAppSettings } from "@/lib/repo/settings";

export async function getPublicFormOptionsAction() {
  const [locations, ranks, settings] = await Promise.all([
    listLocations(false),
    listRanks(false),
    getAppSettings(),
  ]);
  return {
    locations,
    ranks,
    ageGroupThresholds: { youthMin: settings.ageGroupYouthMin, adultMin: settings.ageGroupAdultMin },
  };
}

export async function searchDeaconsByNameAction(firstName: string, lastName: string) {
  return searchDeaconsByName(firstName, lastName);
}

export async function getPublicDeaconMetaAction(id: string) {
  return getPublicDeaconMeta(id);
}

export async function submitNewProfileAction(input: PublicProfileInput) {
  try {
    const result = await createDeaconPublic(input);
    return { ok: true as const, id: result.id };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function submitProfileUpdateAction(id: string, input: PublicProfileInput, overrideFields: string[]) {
  try {
    const result = await resolveProfileUpdate(id, input, overrideFields);
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, conflicts: result.conflicts };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Save failed" };
  }
}

// Only ever used for a brand-new record -- a matched (existing) record's
// photo is never shown or replaceable through this form (see
// PublicProfileForm), so there's nothing to leak or silently overwrite.
export async function setPublicDeaconPhotoAction(id: string, dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  await setDeaconPhoto(id, Buffer.from(base64, "base64"));
  return { ok: true as const };
}

export async function deletePublicDeaconPhotoAction(id: string) {
  await deleteDeaconPhoto(id);
  return { ok: true as const };
}
