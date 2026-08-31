"use server";

import { assertAdmin } from "@/lib/authz";
import { getLiturgyReportContext } from "@/lib/repo/liturgies";
import { getDeaconHistory, getSummaryReport } from "@/lib/repo/reports";
import { getPassionWeekFullSchedule } from "@/lib/repo/passionWeek";
import { setStickyLocation } from "@/lib/repo/users";
import type { ServiceTypeCode } from "@/lib/constants";

export async function getLiturgyReportAction(date: string, locationId: string, serviceType: ServiceTypeCode) {
  const session = await assertAdmin();
  await setStickyLocation(session.user.id, "report", locationId);
  return getLiturgyReportContext(date, locationId, serviceType);
}

export async function getDeaconHistoryReportAction(
  deaconId: string,
  fromDate: string | null,
  toDate: string | null,
  locationId: string | null
) {
  await assertAdmin();
  return getDeaconHistory(deaconId, fromDate, toDate, locationId);
}

export async function getSummaryReportAction(
  fromDate: string | null,
  toDate: string | null,
  locationId: string | null,
  serviceType: ServiceTypeCode | null,
  rankId: string | null,
  dayFilterOptionId: string | null
) {
  await assertAdmin();
  return getSummaryReport(fromDate, toDate, locationId, serviceType, rankId, dayFilterOptionId);
}

export async function getPassionWeekFullScheduleAction(year: number, locationId: string) {
  await assertAdmin();
  return getPassionWeekFullSchedule(year, locationId);
}
