"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { previewArchive, runArchive, type CutoffMonths } from "@/lib/repo/archive";

export async function previewArchiveAction(months: CutoffMonths) {
  await assertAdmin();
  return previewArchive(months);
}

export async function runArchiveAction(months: CutoffMonths) {
  const session = await assertAdmin();
  const result = await runArchive(months, session.user.email!);
  revalidatePath("/archive");
  revalidatePath("/dashboard");
  return result;
}
