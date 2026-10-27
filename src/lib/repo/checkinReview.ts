import { query, withTransaction } from "@/lib/db";
import { SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import { formatChurchDateTime } from "@/lib/timezone";
import type { FlagMethodCode, FlagReasonCode, FlagSelectionCode } from "@/lib/flagReasons";

// ---------------------------------------------------------------------------
// The check-in review list: self check-ins (Agios or QR) the server couldn't
// place inside the church. They're recorded as normal attendance straight
// away; an admin then confirms them (nothing changes) or rejects them (the
// attendance is removed, the flag stays as a log).
// ---------------------------------------------------------------------------

export interface FlagRow {
  id: string;
  deaconId: string;
  deaconName: string;
  locationId: string;
  locationName: string;
  date: string;
  serviceLabel: string;
  method: FlagMethodCode;
  selection: FlagSelectionCode;
  reason: FlagReasonCode;
  distanceFt: number | null;
  status: "pending" | "confirmed" | "rejected";
  /** Church-local, ready to show. */
  createdLabel: string;
  resolvedByName: string | null;
  resolvedLabel: string | null;
  /** Flagged check-ins by this deacon in the last 90 days, this one included. */
  recentCount: number;
}

/** The number on the menu badge and the Dashboard tile. */
export async function countPendingFlags(): Promise<number> {
  const { rows } = await query<{ n: string }>(`select count(*) as n from checkin_flags where status = 'pending'`);
  return Number(rows[0].n);
}

/** Every pending flag (oldest first) plus the most recently reviewed ones. */
export async function listFlags(recentReviewedLimit = 30): Promise<{ pending: FlagRow[]; reviewed: FlagRow[] }> {
  const { rows } = await query<{
    id: string;
    deacon_id: string;
    deacon_name: string;
    location_id: string;
    location_name: string;
    date: string;
    service_type: string;
    method: FlagMethodCode;
    selection: FlagSelectionCode;
    reason: FlagReasonCode;
    distance_ft: number | null;
    status: FlagRow["status"];
    created_at: string;
    resolved_by_name: string | null;
    resolved_at: string | null;
    recent_count: string;
  }>(
    `with ranked as (
       select f.*, row_number() over (partition by (f.status = 'pending') order by
         case when f.status = 'pending' then f.created_at end asc,
         case when f.status <> 'pending' then f.resolved_at end desc) as rn
       from checkin_flags f
     )
     select r.id, r.deacon_id, d.name as deacon_name, r.location_id, l.name as location_name,
            r.date, r.service_type, r.method, r.selection, r.reason, r.distance_ft, r.status,
            r.created_at, coalesce(rd.name, ru.name, ru.email) as resolved_by_name, r.resolved_at,
            (select count(*) from checkin_flags x
              where x.deacon_id = r.deacon_id and x.created_at > now() - interval '90 days') as recent_count
     from ranked r
     join deacons d on d.id = r.deacon_id
     join locations l on l.id = r.location_id
     left join users ru on ru.id = r.resolved_by
     left join deacons rd on rd.id = ru.linked_deacon_id
     where r.status = 'pending' or r.rn <= $1
     order by (r.status = 'pending') desc,
              case when r.status = 'pending' then r.created_at end asc,
              r.resolved_at desc`,
    [recentReviewedLimit]
  );
  const mapped = rows.map<FlagRow>((r) => ({
    id: r.id,
    deaconId: r.deacon_id,
    deaconName: r.deacon_name,
    locationId: r.location_id,
    locationName: r.location_name,
    date: r.date,
    serviceLabel: SERVICE_LABELS[r.service_type as ServiceTypeCode] ?? r.service_type,
    method: r.method,
    selection: r.selection,
    reason: r.reason,
    distanceFt: r.distance_ft,
    status: r.status,
    createdLabel: formatChurchDateTime(r.created_at),
    resolvedByName: r.resolved_by_name,
    resolvedLabel: r.resolved_at ? formatChurchDateTime(r.resolved_at) : null,
    recentCount: Number(r.recent_count),
  }));
  return { pending: mapped.filter((f) => f.status === "pending"), reviewed: mapped.filter((f) => f.status !== "pending") };
}

/**
 * Confirm leaves the attendance as it is. Reject removes the plain attendance
 * marker the deacon set themselves (the same narrow delete as undoing a
 * check-in) and keeps the flag as a record. Only a still-pending flag can be
 * resolved, so two admins acting at once can't both win.
 */
export async function resolveFlag(
  flagId: string,
  action: "confirm" | "reject",
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ status: string; deacon_id: string; liturgy_id: string | null }>(
      `select status, deacon_id, liturgy_id from checkin_flags where id = $1 for update`,
      [flagId]
    );
    const flag = rows[0];
    if (!flag) return { ok: false as const, error: "That check-in no longer exists" };
    if (flag.status !== "pending") return { ok: false as const, error: "Someone has already reviewed this check-in" };
    if (action === "reject" && flag.liturgy_id) {
      await client.query(
        `delete from participation
         where liturgy_id = $1 and deacon_id = $2 and activity_id is null and source = 'self'`,
        [flag.liturgy_id, flag.deacon_id]
      );
    }
    await client.query(
      `update checkin_flags set status = $2, resolved_by = $3, resolved_at = now() where id = $1`,
      [flagId, action === "confirm" ? "confirmed" : "rejected", userId]
    );
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Who gets the phone alert for which church
// ---------------------------------------------------------------------------

export interface AlertAdmin {
  userId: string;
  name: string;
  role: string;
  /** How many devices this admin has turned alerts on for. */
  devices: number;
}

/** Active admins an alert can be sent to, with how many devices each has set up. */
export async function listAlertAdmins(): Promise<AlertAdmin[]> {
  const { rows } = await query<{ id: string; name: string; role: string; devices: string }>(
    `select u.id, coalesce(d.name, u.name, u.email) as name, u.role,
            (select count(*) from push_subscriptions s where s.user_id = u.id) as devices
     from users u left join deacons d on d.id = u.linked_deacon_id
     where u.status = 'Active' and u.role in ('SystemAdmin', 'GeneralAdmin')
     order by name`
  );
  return rows.map((r) => ({ userId: r.id, name: r.name, role: r.role, devices: Number(r.devices) }));
}

/** locationId -> the user ids chosen to be alerted about that church. */
export async function listFlagRecipients(): Promise<Record<string, string[]>> {
  const { rows } = await query<{ location_id: string; user_id: string }>(
    `select location_id, user_id from flag_recipients`
  );
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.location_id] ??= []).push(r.user_id);
  return out;
}

export async function setFlagRecipients(locationId: string, userIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`delete from flag_recipients where location_id = $1`, [locationId]);
    if (userIds.length === 0) return;
    // Only active admins can be chosen, whatever the client sends.
    await client.query(
      `insert into flag_recipients (location_id, user_id)
       select $1, u.id from users u
       where u.id = any($2::uuid[]) and u.status = 'Active' and u.role in ('SystemAdmin', 'GeneralAdmin')`,
      [locationId, userIds]
    );
  });
}

// ---------------------------------------------------------------------------
// Devices that have alerts turned on
// ---------------------------------------------------------------------------

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A device belongs to whoever turned alerts on last -- a shared computer follows the person using it. */
export async function savePushSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [userId, sub.endpoint, sub.p256dh, sub.auth]
  );
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await query(`delete from push_subscriptions where user_id = $1 and endpoint = $2`, [userId, endpoint]);
}

export async function hasPushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const { rows } = await query(`select 1 from push_subscriptions where user_id = $1 and endpoint = $2`, [
    userId,
    endpoint,
  ]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

export interface QrChurch {
  locationId: string;
  name: string;
  token: string;
}

export async function listQrChurches(): Promise<QrChurch[]> {
  const { rows } = await query<{ id: string; name: string; qr_token: string }>(
    `select id, name, qr_token from locations where status = 'Active' order by name`
  );
  return rows.map((r) => ({ locationId: r.id, name: r.name, token: r.qr_token }));
}

/** A fresh secret for one church: every printout or photo of the old code stops working at once. */
export async function regenerateQrToken(locationId: string): Promise<string> {
  const { rows } = await query<{ qr_token: string }>(
    `update locations set qr_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
     where id = $1 returning qr_token`,
    [locationId]
  );
  if (!rows[0]) throw new Error("Church not found");
  return rows[0].qr_token;
}
