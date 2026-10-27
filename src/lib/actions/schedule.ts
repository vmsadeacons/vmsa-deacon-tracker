"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import {
  getScheduleOptions,
  addExtraLiturgy,
  planRecurringExtras,
  addRecurringExtras,
  removeExtra,
  removeExtraSeries,
  setStartTimesForDay,
  setCheckinWindowSettings,
  type RecurringInput,
} from "@/lib/repo/liturgySchedule";

// Everything about when liturgies happen and when check-in is open is an
// everyday admin task, so any admin (General or System) can do all of it.

/** What a Service picker should offer for a church on a date, plus which one to start on. */
export async function getScheduleOptionsAction(locationId: string, date: string) {
  await assertAdmin();
  return getScheduleOptions(locationId, date);
}

function refresh() {
  revalidatePath("/checkin");
}

export async function addExtraLiturgyAction(
  locationId: string,
  date: string,
  startTime: string,
  startsEveningBefore: boolean
) {
  const session = await assertAdmin();
  try {
    const { serviceType } = await addExtraLiturgy(locationId, date, startTime, startsEveningBefore, session.user.id);
    refresh();
    return { ok: true as const, serviceType };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function planRecurringExtrasAction(input: RecurringInput) {
  await assertAdmin();
  try {
    const plan = await planRecurringExtras(input);
    return {
      ok: true as const,
      willAdd: plan.planned.length,
      skippedHasExtra: plan.skippedHasExtra,
      skippedFull: plan.skippedFull,
      skippedRecorded: plan.skippedRecorded,
    };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function addRecurringExtrasAction(input: RecurringInput) {
  const session = await assertAdmin();
  try {
    const result = await addRecurringExtras(input, session.user.id);
    refresh();
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function removeExtraAction(id: string) {
  await assertAdmin();
  try {
    await removeExtra(id);
    refresh();
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function removeExtraSeriesAction(seriesId: string) {
  await assertAdmin();
  try {
    const result = await removeExtraSeries(seriesId);
    refresh();
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setStartTimesForDayAction(
  locationId: string,
  weekday: number,
  times: { S1: string; S2?: string }
) {
  await assertAdmin();
  try {
    await setStartTimesForDay(locationId, weekday, times);
    refresh();
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function setCheckinWindowSettingsAction(openBefore: number, closeAfter: number) {
  await assertAdmin();
  try {
    await setCheckinWindowSettings(openBefore, closeAfter);
    refresh();
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
