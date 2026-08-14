"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import {
  createDeacon,
  updateDeacon,
  deleteDeacon,
  archiveDeacon,
  setDeaconPhoto,
  deleteDeaconPhoto,
  type DeaconInput,
} from "@/lib/repo/deacons";

export async function createDeaconAction(input: DeaconInput) {
  await assertAdmin();
  try {
    const deacon = await createDeacon(input);
    revalidatePath("/deacons");
    return { ok: true as const, deacon };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function updateDeaconAction(id: string, input: Partial<DeaconInput>) {
  await assertAdmin();
  try {
    const deacon = await updateDeacon(id, input);
    revalidatePath("/deacons");
    return { ok: true as const, deacon };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function setDeaconPhotoAction(id: string, dataUrl: string) {
  await assertAdmin();
  const base64 = dataUrl.split(",")[1] ?? "";
  await setDeaconPhoto(id, Buffer.from(base64, "base64"));
  revalidatePath("/deacons");
}

export async function deleteDeaconPhotoAction(id: string) {
  await assertAdmin();
  await deleteDeaconPhoto(id);
  revalidatePath("/deacons");
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
