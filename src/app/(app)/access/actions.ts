"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import {
  grantAccess,
  updateUser,
  setUserPin,
  setUserStatus,
  deleteUser,
} from "@/lib/repo/users";
import type { Role } from "@/lib/constants";

export async function grantAccessAction(params: {
  email: string;
  name: string | null;
  role: Role;
  linkedDeaconId: string | null;
  pin: string | null;
}) {
  const session = await assertAdmin();
  try {
    const user = await grantAccess({ ...params, actorRole: session.user.role });
    revalidatePath("/access");
    return { ok: true as const, user };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateUserAction(
  id: string,
  patch: { email?: string; role?: Role; linkedDeaconId?: string | null; pin?: string | null }
) {
  const session = await assertAdmin();
  try {
    const user = await updateUser(id, patch, session.user.role);
    revalidatePath("/access");
    return { ok: true as const, user };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setUserPinAction(id: string, pin: string) {
  const session = await assertAdmin();
  try {
    await setUserPin(id, pin, session.user.role);
    revalidatePath("/access");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setUserStatusAction(id: string, status: "Active" | "Disabled") {
  const session = await assertAdmin();
  try {
    await setUserStatus(id, status, session.user.role);
    revalidatePath("/access");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteUserAction(id: string) {
  const session = await assertAdmin();
  try {
    await deleteUser(id, session.user.role);
    revalidatePath("/access");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
