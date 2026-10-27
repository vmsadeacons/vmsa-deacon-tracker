import webpush from "web-push";
import { query } from "@/lib/db";
import { countPendingFlags } from "@/lib/repo/checkinReview";
import { describeFlag, methodLabel, type FlagReasonCode, type FlagSelectionCode, type FlagMethodCode } from "@/lib/flagReasons";

// Phone/computer alerts for the check-in review list, sent with the Web Push
// standard. The three VAPID values live in Vercel's environment variables
// (see DEPLOYMENT.md); without them everything here quietly does nothing and
// the review list still works.

function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://vmsa-deacon-tracker.vercel.app", publicKey, privateKey);
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

interface Payload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Sends to every given user's devices; devices the push service reports as gone are forgotten. Returns how many were delivered. */
async function sendToUsers(userIds: string[], payload: Payload): Promise<number> {
  if (userIds.length === 0 || !configure()) return 0;
  const { rows } = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `select id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])`,
    [userIds]
  );
  const body = JSON.stringify(payload);
  let delivered = 0;
  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
          TTL: 3600,
        });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await query(`delete from push_subscriptions where id = $1`, [sub.id]);
        }
      }
    })
  );
  return delivered;
}

/**
 * Alerts the admins chosen for the flag's church -- or, when nobody is chosen
 * for it, every active admin who has alerts on. Never throws: a failed alert
 * must not undo or hold up the deacon's check-in. Alerts share one tag, so a
 * new one replaces the last instead of piling up on the phone.
 */
export async function notifyFlag(flagId: string): Promise<void> {
  try {
    if (!configure()) return;
    const { rows } = await query<{
      location_id: string;
      location_name: string;
      deacon_name: string;
      method: FlagMethodCode;
      selection: FlagSelectionCode;
      reason: FlagReasonCode;
      distance_ft: number | null;
    }>(
      `select f.location_id, l.name as location_name, d.name as deacon_name, f.method, f.selection, f.reason, f.distance_ft
       from checkin_flags f join locations l on l.id = f.location_id join deacons d on d.id = f.deacon_id
       where f.id = $1`,
      [flagId]
    );
    const flag = rows[0];
    if (!flag) return;

    const { rows: chosen } = await query<{ user_id: string }>(
      `select r.user_id from flag_recipients r join users u on u.id = r.user_id
       where r.location_id = $1 and u.status = 'Active' and u.role in ('SystemAdmin', 'GeneralAdmin')`,
      [flag.location_id]
    );
    let userIds = chosen.map((r) => r.user_id);
    if (userIds.length === 0) {
      const { rows: everyone } = await query<{ id: string }>(
        `select id from users where status = 'Active' and role in ('SystemAdmin', 'GeneralAdmin')`
      );
      userIds = everyone.map((r) => r.id);
    }

    const waiting = await countPendingFlags();
    await sendToUsers(userIds, {
      title: `Check-in to review · ${flag.location_name}`,
      body: `${flag.deacon_name} (${methodLabel(flag.method)}). ${describeFlag({
        reason: flag.reason,
        selection: flag.selection,
        distanceFt: flag.distance_ft,
        locationName: flag.location_name,
      })} ${waiting} waiting for review.`,
      url: "/checkin-review",
      tag: "checkin-review",
    });
  } catch (err) {
    console.error("notifyFlag failed", err);
  }
}

/** The "Send a test alert" button: just to the admin who pressed it. */
export async function sendTestAlert(userId: string): Promise<{ ok: true; delivered: number } | { ok: false; error: string }> {
  if (!configure()) return { ok: false, error: "Alerts aren't set up on this site yet." };
  const delivered = await sendToUsers([userId], {
    title: "Test alert",
    body: "Check-in review alerts are working on this device.",
    url: "/checkin-review",
    tag: "checkin-review-test",
  });
  return delivered > 0
    ? { ok: true, delivered }
    : { ok: false, error: "No device of yours could be reached. Turn alerts on for this device first." };
}
