"use server";

import { computeDefaultServiceType } from "@/lib/timezone";

/** Client components can't safely read CHURCH_TIMEZONE, so the recompute happens server-side. */
export async function computeDefaultServiceAction(date: string) {
  return computeDefaultServiceType(date);
}
