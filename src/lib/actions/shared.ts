"use server";

import { computeDefaultServiceType, monthsAgoISO, churchTodayISO, yearStartISO } from "@/lib/timezone";

/** Client components can't safely read CHURCH_TIMEZONE, so the recompute happens server-side. */
export async function computeDefaultServiceAction(date: string) {
  return computeDefaultServiceType(date);
}

export async function monthsAgoAction(months: number) {
  return monthsAgoISO(months);
}

export async function churchTodayAction() {
  return churchTodayISO();
}

export async function yearStartAction() {
  return yearStartISO();
}
