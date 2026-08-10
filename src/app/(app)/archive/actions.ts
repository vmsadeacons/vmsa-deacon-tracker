"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, assertSystemAdmin } from "@/lib/authz";
import { previewArchive, runArchive, type CutoffMonths } from "@/lib/repo/archive";

// Previewing is read-only, so both admin roles can see it (spec follow-up:
// General Admins keep view access to Archive, only running it is
// SystemAdmin-only).
export async function previewArchiveAction(months: CutoffMonths) {
  await assertAdmin();
  return previewArchive(months);
}

export async function runArchiveAction(months: CutoffMonths) {
  const session = await assertSystemAdmin();
  const result = await runArchive(months, session.user.email!);
  revalidatePath("/archive");
  revalidatePath("/dashboard");
  return result;
}
