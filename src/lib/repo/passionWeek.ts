import { query } from "@/lib/db";
import {
  PW_SERVICES,
  pwHoursFor,
  pwSlotCount,
  PW_ACTIVITIES,
  type PWServiceId,
  type PWActivityId,
} from "@/lib/constants";

export interface PWAssignmentRow {
  hour: string;
  activity_id: PWActivityId;
  slot_index: number;
  deacon_id: string;
  deacon_name: string;
  deacon_status: "Active" | "Archived";
}

/** {hour: {activityId: {slotIndex: {deaconId, name}}}} — keyed explicitly by slot index (spec §6.4). */
export type PWOverview = Record<
  string,
  Record<string, Record<number, { deaconId: string; name: string }>>
>;

export async function getPassionWeekOverview(
  year: number,
  locationId: string,
  serviceId: PWServiceId
): Promise<PWOverview> {
  const { rows } = await query<PWAssignmentRow>(
    `select p.hour, p.activity_id, p.slot_index, p.deacon_id, d.name as deacon_name, d.status as deacon_status
     from passion_week_participation p
     join deacons d on d.id = p.deacon_id
     where p.year = $1 and p.location_id = $2 and p.service_id = $3`,
    [year, locationId, serviceId]
  );
  const overview: PWOverview = {};
  for (const hour of pwHoursFor(serviceId)) overview[hour] = {};
  for (const row of rows) {
    overview[row.hour] ??= {};
    overview[row.hour][row.activity_id] ??= {};
    overview[row.hour][row.activity_id][row.slot_index] = {
      deaconId: row.deacon_id,
      name: row.deacon_name,
    };
  }
  return overview;
}

/** Admin-only: every service at once, for the Reports "Passion Week" tab. Spec §7.9.4. */
export async function getPassionWeekFullSchedule(
  year: number,
  locationId: string
): Promise<Record<PWServiceId, PWOverview>> {
  const { rows } = await query<PWAssignmentRow & { service_id: PWServiceId }>(
    `select p.service_id, p.hour, p.activity_id, p.slot_index, p.deacon_id,
            d.name as deacon_name, d.status as deacon_status
     from passion_week_participation p
     join deacons d on d.id = p.deacon_id
     where p.year = $1 and p.location_id = $2`,
    [year, locationId]
  );

  const schedule = {} as Record<PWServiceId, PWOverview>;
  for (const svc of PW_SERVICES) {
    const overview: PWOverview = {};
    for (const hour of pwHoursFor(svc.id)) overview[hour] = {};
    schedule[svc.id] = overview;
  }
  for (const row of rows) {
    const overview = schedule[row.service_id];
    if (!overview) continue;
    overview[row.hour] ??= {};
    overview[row.hour][row.activity_id] ??= {};
    overview[row.hour][row.activity_id][row.slot_index] = {
      deaconId: row.deacon_id,
      name: row.deacon_name,
    };
  }
  return schedule;
}

/** Sets (or clears, when deaconId is null) one exact slot. */
export async function setPassionWeekAssignment(params: {
  year: number;
  locationId: string;
  serviceId: PWServiceId;
  hour: string;
  activityId: PWActivityId;
  slotIndex: number;
  deaconId: string | null;
}): Promise<void> {
  const maxSlots = pwSlotCount(params.serviceId, params.activityId);
  if (params.slotIndex < 0 || params.slotIndex >= maxSlots) {
    throw new Error("Invalid slot index for this hour/activity");
  }
  await query(
    `delete from passion_week_participation
     where year = $1 and location_id = $2 and service_id = $3 and hour = $4
       and activity_id = $5 and slot_index = $6`,
    [params.year, params.locationId, params.serviceId, params.hour, params.activityId, params.slotIndex]
  );
  if (params.deaconId) {
    await query(
      `insert into passion_week_participation
         (year, location_id, service_id, hour, activity_id, slot_index, deacon_id)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.year,
        params.locationId,
        params.serviceId,
        params.hour,
        params.activityId,
        params.slotIndex,
        params.deaconId,
      ]
    );
  }
}

export { PW_ACTIVITIES };
