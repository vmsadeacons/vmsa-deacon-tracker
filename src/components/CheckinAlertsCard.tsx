"use client";

import { useEffect, useState } from "react";
import type { AlertAdmin } from "@/lib/repo/checkinReview";
import {
  getAlertSetupAction,
  savePushSubscriptionAction,
  removePushSubscriptionAction,
  sendTestAlertAction,
  setFlagRecipientsAction,
} from "@/lib/actions/checkinReview";

type Device =
  | { state: "checking" }
  | { state: "unsupported" }
  | { state: "not-configured" }
  | { state: "blocked" }
  | { state: "off" }
  | { state: "on" };

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Phone alerts for flagged check-ins: turning them on for this device, and choosing which admins hear about which church. */
export default function CheckinAlertsCard({
  churches,
  admins,
  recipients,
}: {
  churches: { id: string; name: string }[];
  admins: AlertAdmin[];
  recipients: Record<string, string[]>;
}) {
  const [device, setDevice] = useState<Device>({ state: "checking" });
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chosen, setChosen] = useState<Record<string, string[]>>(recipients);
  const [savingChurch, setSavingChurch] = useState<string | null>(null);

  // What this device can do and whether it's already signed up -- worked out
  // in the browser after the page loads (the server can't know either).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setDevice({ state: "unsupported" });
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        const setup = await getAlertSetupAction(existing?.endpoint ?? null);
        if (cancelled) return;
        setPublicKey(setup.publicKey);
        if (!setup.publicKey) setDevice({ state: "not-configured" });
        else if (Notification.permission === "denied") setDevice({ state: "blocked" });
        else setDevice({ state: setup.subscribed ? "on" : "off" });
      } catch {
        if (!cancelled) setDevice({ state: "unsupported" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice({ state: permission === "denied" ? "blocked" : "off" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
      const json = sub.toJSON();
      const res = await savePushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDevice({ state: "on" });
      setMessage("Alerts are on for this device.");
    } catch {
      setError("Couldn't turn alerts on for this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setDevice({ state: "off" });
      setMessage("Alerts are off for this device.");
    } catch {
      setError("Couldn't turn alerts off. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await sendTestAlertAction();
    setBusy(false);
    if (res.ok) setMessage("Test alert sent — it should appear on this device in a moment.");
    else setError(res.error);
  }

  async function toggleAdmin(locationId: string, userId: string) {
    const current = chosen[locationId] ?? [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    setChosen({ ...chosen, [locationId]: next });
    setSavingChurch(locationId);
    await setFlagRecipientsAction(locationId, next);
    setSavingChurch(null);
  }

  return (
    <div className="card">
      <h3>Check-in review alerts</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        When a check-in can&apos;t be confirmed, the admins chosen for that church get an alert on their phone or
        computer. Everyone sees every item on the Check-in review page either way.
      </p>

      <h4 style={{ margin: "0 0 0.4rem" }}>This device</h4>
      {device.state === "checking" && <p className="muted">Checking…</p>}
      {device.state === "unsupported" && (
        <p className="muted">
          This browser can&apos;t receive alerts. On an iPhone or iPad, first add this app to your Home Screen (tap
          Share, then Add to Home Screen), open it from there, and come back to this page. Computers and Android phones
          work in the normal browser.
        </p>
      )}
      {device.state === "not-configured" && (
        <p className="muted">Alerts haven&apos;t been set up on this site yet, so none can be sent.</p>
      )}
      {device.state === "blocked" && (
        <p className="muted">
          Alerts are blocked for this site in this browser. Allow notifications for it in the browser or phone settings,
          then reload this page.
        </p>
      )}
      {(device.state === "off" || device.state === "on") && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className={device.state === "on" ? "badge badge-green" : "badge badge-grey"}>
            {device.state === "on" ? "Alerts on" : "Alerts off"}
          </span>
          {device.state === "off" ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={turnOn}>
              Turn on alerts on this device
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={sendTest}>
                Send a test alert
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={turnOff}>
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {message && <p style={{ marginTop: "0.6rem", color: "var(--green)" }}>{message}</p>}
      {error && <p className="error-text" style={{ marginTop: "0.6rem" }}>{error}</p>}

      <h4 style={{ margin: "1.4rem 0 0.4rem" }}>Who is alerted for each church</h4>
      <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
        If nobody is chosen for a church, every admin who has alerts on is alerted instead. An admin only receives
        alerts once they&apos;ve turned them on from their own device.
      </p>
      {churches.map((church) => (
        <div
          key={church.id}
          style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 0", display: "flex", gap: "1rem", flexWrap: "wrap" }}
        >
          <div style={{ flex: "0 0 12rem", fontWeight: 600 }}>
            {church.name}
            {savingChurch === church.id && <span className="muted" style={{ fontWeight: 400 }}> · saving…</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.2rem", flex: 1 }}>
            {admins.map((a) => (
              <label key={a.userId} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.92rem" }}>
                <input
                  type="checkbox"
                  checked={(chosen[church.id] ?? []).includes(a.userId)}
                  onChange={() => toggleAdmin(church.id, a.userId)}
                />
                <span>
                  {a.name}
                  {a.devices === 0 && <span className="muted"> (no device yet)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
