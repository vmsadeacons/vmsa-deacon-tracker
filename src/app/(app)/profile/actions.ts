"use server";

import { revalidatePath } from "next/cache";
import { assertSession } from "@/lib/authz";
import { updateDeacon, setDeaconPhoto, deleteDeaconPhoto } from "@/lib/repo/deacons";
import type { AgeGroup } from "@/lib/constants";

/**
 * Deacon self-service — deliberately narrower than the admin's updateDeacon:
 * name, status, and notes are never accepted here, regardless of what the
 * client sends (spec §7.11). DOB, age group, and year of ordination were
 * added to My Profile by explicit request; the app's existing "DOB always
 * wins when present" rule already gives a self-entered DOB priority over
 * the age-group override, since it's the same shared record whoever edits
 * it last (spec §6.8).
 */
export async function updateMyProfileAction(patch: {
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  dob: string | null;
  ageGroupOverride: AgeGroup | null;
  rankId: string;
  ordinationYear: number | null;
  locationPrefs: string[];
  liturgyPrefs: string[];
}) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  await updateDeacon(session.user.linkedDeaconId, patch);
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function setMyPhotoAction(dataUrl: string) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  const base64 = dataUrl.split(",")[1] ?? "";
  await setDeaconPhoto(session.user.linkedDeaconId, Buffer.from(base64, "base64"));
  revalidatePath("/profile");
}

export async function deleteMyPhotoAction() {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  await deleteDeaconPhoto(session.user.linkedDeaconId);
  revalidatePath("/profile");
}
