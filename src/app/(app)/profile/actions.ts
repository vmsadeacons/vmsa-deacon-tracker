"use server";

import { revalidatePath } from "next/cache";
import { assertSession } from "@/lib/authz";
import { updateDeacon } from "@/lib/repo/deacons";
import type { DeaconRank } from "@/lib/constants";

/**
 * Deacon self-service — deliberately narrower than the admin's updateDeacon:
 * name, status, notes, and age-group override are never accepted here,
 * regardless of what the client sends (spec §7.11).
 */
export async function updateMyProfileAction(patch: {
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  rank: DeaconRank;
  locationPrefs: string[];
  liturgyPrefs: string[];
}) {
  const session = await assertSession();
  if (!session.user.linkedDeaconId) throw new Error("Your account isn't linked to a deacon record");
  await updateDeacon(session.user.linkedDeaconId, patch);
  revalidatePath("/profile");
  return { ok: true as const };
}
