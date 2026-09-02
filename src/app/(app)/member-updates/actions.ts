"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { decideOverrideRequest } from "@/lib/repo/publicProfile";

export async function decideOverrideRequestAction(id: string, approve: boolean) {
  await assertAdmin();
  try {
    await decideOverrideRequest(id, approve);
    revalidatePath("/member-updates");
    revalidatePath("/deacons");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Couldn't save" };
  }
}
