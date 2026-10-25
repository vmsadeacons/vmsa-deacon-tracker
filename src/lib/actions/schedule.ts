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
  type RecurringInput,
} from "@/lib/repo/liturgySchedule";

// Schedule changes are an everyday admin task (unlike most of Settings, which
// is System Admin only), so any admin can add and remove extra liturgies.

/** What a Service picker should offer for a church on a date, plus which one to start on. */
export async function getScheduleOptionsAction(locationId: string, date: string) {
  await assertAdmin();
  return getScheduleOptions(locationId, date);
}

export async function addExtraLiturgyAction(locationId: string, date: string, startTime: string | null) {
  const session = await assertAdmin();
  try {
    const { serviceType } = await addExtraLiturgy(locationId, date, startTime, session.user.id);
    revalidatePath("/settings");
    revalidatePath("/checkin");
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
    };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function addRecurringExtrasAction(input: RecurringInput) {
  const session = await assertAdmin();
  try {
    const result = await addRecurringExtras(input, session.user.id);
    revalidatePath("/settings");
    revalidatePath("/checkin");
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function removeExtraAction(id: string) {
  await assertAdmin();
  try {
    await removeExtra(id);
    revalidatePath("/settings");
    revalidatePath("/checkin");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function removeExtraSeriesAction(seriesId: string) {
  await assertAdmin();
  try {
    const result = await removeExtraSeries(seriesId);
    revalidatePath("/settings");
    revalidatePath("/checkin");
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
