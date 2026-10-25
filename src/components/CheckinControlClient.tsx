"use client";

import { useEffect, useRef, useState } from "react";
import type { TodayLocation } from "@/lib/repo/liturgySchedule";
import type { ServiceTypeCode } from "@/lib/constants";
import { getTodaySnapshotAction, setLockOverrideAction } from "@/app/(app)/checkin/actions";
import { addExtraLiturgyAction } from "@/lib/actions/schedule";
import { weekdayLabel } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";

type Snapshot = { date: string; locations: TodayLocation[] };

const REFRESH_MS = 30_000;

const STATUS_BADGE: Record<string, { className: string; text: string }> = {
  open: { className: "badge badge-green", text: "Open" },
  upcoming: { className: "badge badge-grey", text: "Not yet" },
  closed: { className: "badge badge-amber", text: "Closed" },
};

export default function CheckinControlClient({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Keeps the page current while it's on screen (the open window moves with
  // the clock, and another admin may change things) -- paused while the tab
  // is hidden so it costs nothing in the background.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      setSnapshot(await getTodaySnapshotAction());
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  async function setOverride(locationId: string, serviceType: ServiceTypeCode, state: "open" | "closed" | null) {
    const key = `${locationId}|${serviceType}`;
    busyRef.current = true;
    setBusyKey(key);
    setError(null);
    const res = await setLockOverrideAction(locationId, serviceType, state);
    busyRef.current = false;
    setBusyKey(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSnapshot(res.snapshot);
  }

  async function addExtra(locationId: string) {
    const key = `${locationId}|add`;
    busyRef.current = true;
    setBusyKey(key);
    setError(null);
    const res = await addExtraLiturgyAction(locationId, snapshot.date, null);
    if (!res.ok) setError(res.error);
    else setSnapshot(await getTodaySnapshotAction());
    busyRef.current = false;
    setBusyKey(null);
  }

  return (
    <div>
      <h1>Check-in</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {weekdayLabel(snapshot.date)}, {snapshot.date}. Deacons check in through Agios Check-in, which always puts them
        into the one liturgy that is open at their church. A liturgy opens 30 minutes before it starts and closes when the
        next one opens. Use the buttons to open or close one by hand; admins can always record any liturgy in Record a
        Liturgy regardless.
      </p>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {snapshot.locations.map((loc) => (
        <div className="card" key={loc.locationId}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{loc.name}</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loc.liturgies.length >= 3 || busyKey === `${loc.locationId}|add`}
              onClick={() => addExtra(loc.locationId)}
            >
              {busyKey === `${loc.locationId}|add` ? "Adding…" : "+ Add another liturgy today"}
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Liturgy</th>
                  <th>Starts</th>
                  <th>Check-in</th>
                  <th>Checked in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loc.liturgies.map((l) => {
                  const key = `${loc.locationId}|${l.serviceType}`;
                  const badge = STATUS_BADGE[l.status];
                  const busy = busyKey === key;
                  return (
                    <tr key={l.serviceType}>
                      <td>
                        {l.label}
                        {l.isExtra && <span className="muted"> (extra)</span>}
                      </td>
                      <td>{formatTime12(l.startTime)}</td>
                      <td>
                        <span className={badge.className}>{badge.text}</span>
                        <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>{l.note}</div>
                      </td>
                      <td>{l.attendeeCount}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {l.status !== "open" && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.serviceType, "open")}
                            >
                              Open now
                            </button>
                          )}
                          {l.status === "open" && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.serviceType, "closed")}
                            >
                              Close now
                            </button>
                          )}
                          {l.override !== null && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.serviceType, null)}
                            >
                              Back to automatic
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {snapshot.locations.length === 0 && <p className="muted">There are no active churches.</p>}
    </div>
  );
}
