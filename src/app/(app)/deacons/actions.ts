"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import {
  createDeacon,
  updateDeacon,
  deleteDeacon,
  archiveDeacon,
  type DeaconInput,
} from "@/lib/repo/deacons";

export async function createDeaconAction(input: DeaconInput) {
  await assertAdmin();
  const deacon = await createDeacon(input);
  revalidatePath("/deacons");
  return { ok: true as const, deacon };
}

export async function updateDeaconAction(id: string, input: Partial<DeaconInput>) {
  await assertAdmin();
  const deacon = await updateDeacon(id, input);
  revalidatePath("/deacons");
  return { ok: true as const, deacon };
}

export async function archiveDeaconAction(id: string) {
  const session = await assertAdmin();
  await archiveDeacon(id, session.user.role);
  revalidatePath("/deacons");
  revalidatePath("/access");
  return { ok: true as const };
}

export async function deleteDeaconAction(id: string) {
  const session = await assertAdmin();
  const result = await deleteDeacon(id, session.user.role);
  if (!result.ok) return result;
  revalidatePath("/deacons");
  revalidatePath("/access");
  return { ok: true as const };
}
