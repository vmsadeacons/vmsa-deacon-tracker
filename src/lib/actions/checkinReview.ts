"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import {
  resolveFlag,
  setFlagRecipients,
  savePushSubscription,
  removePushSubscription,
  hasPushSubscription,
  regenerateQrToken,
} from "@/lib/repo/checkinReview";
import { getVapidPublicKey, sendTestAlert } from "@/lib/push";

// The check-in review list, who gets alerted, and the QR codes are everyday
// admin work, so any admin (General or System) can do all of it.

export async function resolveFlagAction(flagId: string, action: "confirm" | "reject") {
  const session = await assertAdmin();
  const res = await resolveFlag(flagId, action, session.user.id);
  revalidatePath("/checkin-review");
  return res;
}

export async function setFlagRecipientsAction(locationId: string, userIds: string[]) {
  await assertAdmin();
  await setFlagRecipients(locationId, userIds);
  revalidatePath("/checkin");
  return { ok: true as const };
}

/** Whether alerts can be sent from this site at all, and whether this device (identified by its push endpoint) is already signed up. */
export async function getAlertSetupAction(endpoint: string | null) {
  const session = await assertAdmin();
  return {
    publicKey: getVapidPublicKey(),
    subscribed: endpoint ? await hasPushSubscription(session.user.id, endpoint) : false,
  };
}

export async function savePushSubscriptionAction(sub: { endpoint: string; p256dh: string; auth: string }) {
  const session = await assertAdmin();
  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) {
    return { ok: false as const, error: "That device couldn't be registered" };
  }
  await savePushSubscription(session.user.id, sub);
  revalidatePath("/checkin");
  return { ok: true as const };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const session = await assertAdmin();
  await removePushSubscription(session.user.id, endpoint);
  revalidatePath("/checkin");
  return { ok: true as const };
}

export async function sendTestAlertAction() {
  const session = await assertAdmin();
  return sendTestAlert(session.user.id);
}

export async function regenerateQrTokenAction(locationId: string) {
  await assertAdmin();
  try {
    await regenerateQrToken(locationId);
    revalidatePath("/checkin");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Couldn't make a new code" };
  }
}
