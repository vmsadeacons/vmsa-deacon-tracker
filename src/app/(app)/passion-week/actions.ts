"use server";

import { assertAdmin } from "@/lib/authz";
import { getPassionWeekOverview, setPassionWeekAssignment } from "@/lib/repo/passionWeek";
import type { PWServiceId, PWActivityId } from "@/lib/constants";

export async function getPassionWeekOverviewAction(
  year: number,
  locationId: string,
  serviceId: PWServiceId
) {
  await assertAdmin();
  return getPassionWeekOverview(year, locationId, serviceId);
}

export async function setPassionWeekAssignmentAction(params: {
  year: number;
  locationId: string;
  serviceId: PWServiceId;
  hour: string;
  activityId: PWActivityId;
  slotIndex: number;
  deaconId: string | null;
}) {
  await assertAdmin();
  await setPassionWeekAssignment(params);
  return getPassionWeekOverview(params.year, params.locationId, params.serviceId);
}
