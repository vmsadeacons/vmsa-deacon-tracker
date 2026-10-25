"use server";

import { monthsAgoISO, churchTodayISO, yearStartISO } from "@/lib/timezone";

/** Client components can't safely read CHURCH_TIMEZONE, so these date helpers run server-side. */

export async function monthsAgoAction(months: number) {
  return monthsAgoISO(months);
}

export async function churchTodayAction() {
  return churchTodayISO();
}

export async function yearStartAction() {
  return yearStartISO();
}
