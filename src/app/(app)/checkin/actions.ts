"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { getTodaySnapshot, setLockOverride, type OverrideState } from "@/lib/repo/liturgySchedule";
import type { ServiceTypeCode } from "@/lib/constants";

// Deacons no longer have a logged-in check-in: they check in through Agios
// Check-in (and, next, the church QR code). This page and these actions are
// the admins' view of what's open, with a manual override -- open for admins
// always, the same way Record a Liturgy always is.

export async function getTodaySnapshotAction() {
  await assertAdmin();
  return getTodaySnapshot();
}

/** Force a liturgy open or closed for check-in today; null puts it back on the automatic schedule. */
export async function setLockOverrideAction(
  locationId: string,
  serviceType: ServiceTypeCode,
  state: OverrideState | null
) {
  const session = await assertAdmin();
  try {
    await setLockOverride(locationId, serviceType, state, session.user.id);
    revalidatePath("/checkin");
    return { ok: true as const, snapshot: await getTodaySnapshot() };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
