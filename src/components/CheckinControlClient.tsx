"use client";

import { useEffect, useRef, useState } from "react";
import type { TodayLocation } from "@/lib/repo/liturgySchedule";
import type { ServiceTypeCode } from "@/lib/constants";
import { getTodaySnapshotAction, setLockOverrideAction } from "@/app/(app)/checkin/actions";
import { weekdayLabel } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";
import AccessNote, { ACCESS } from "./AccessNote";
import AddExtraInline from "./AddExtraInline";

type Snapshot = { date: string; locations: TodayLocation[] };

const REFRESH_MS = 30_000;

const STATUS_BADGE: Record<string, { className: string; text: string }> = {
  open: { className: "badge badge-green", text: "Open" },
  upcoming: { className: "badge badge-grey", text: "Not yet" },
  closed: { className: "badge badge-amber", text: "Closed" },
};

/** The top of the Check-in windows page: what's open right now at every church, with manual open/close. */
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

  async function setOverride(
    locationId: string,
    date: string,
    serviceType: ServiceTypeCode,
    state: "open" | "closed" | null
  ) {
    const key = `${locationId}|${date}|${serviceType}`;
    busyRef.current = true;
    setBusyKey(key);
    setError(null);
    const res = await setLockOverrideAction(locationId, date, serviceType, state);
    busyRef.current = false;
    setBusyKey(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSnapshot(res.snapshot);
  }

  return (
    <div>
      <h1>Check-in windows</h1>
      <AccessNote>{ACCESS.adminsEdit}</AccessNote>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      <div className="card roomy">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Today</h3>
          <span className="muted">{weekdayLabel(snapshot.date)}, {snapshot.date}</span>
        </div>
      {snapshot.locations.map((loc) => (
        <div
          key={loc.locationId}
          style={{ borderTop: "2px solid var(--border)", marginTop: "1.1rem", paddingTop: "1.1rem" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{loc.name}</h3>
            <AddExtraInline
              locationId={loc.locationId}
              date={snapshot.date}
              label="+ Add another liturgy today"
              disabled={loc.liturgies.filter((l) => !l.forAnotherDay).length >= 3}
              onAdded={async () => setSnapshot(await getTodaySnapshotAction())}
            />
          </div>
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="table table-flush-end table-stack table-compact">
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
                  const key = `${loc.locationId}|${l.date}|${l.serviceType}`;
                  const badge = STATUS_BADGE[l.status];
                  const busy = busyKey === key;
                  return (
                    <tr key={key}>
                      <td className="stack-title c-title">
                        {l.label}
                        {l.isExtra && <span className="muted" style={{ fontWeight: 400 }}> (extra)</span>}
                        {l.forAnotherDay && (
                          <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 400 }}>for {weekdayLabel(l.date)}</div>
                        )}
                      </td>
                      <td data-label="starts" className="c-starts">
                        {l.startTime ? formatTime12(l.startTime) : "—"}
                        {l.startsEveningBefore && <div className="muted" style={{ fontSize: "0.8rem" }}>the evening before</div>}
                      </td>
                      <td data-label="Check-in" className="c-checkin">
                        <span className={badge.className}>{badge.text}</span>
                        <div className="muted c-note" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>{l.note}</div>
                      </td>
                      <td data-label="Checked in" className="stack-inline c-count">{l.attendeeCount}</td>
                      <td className="c-actions">
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {l.status !== "open" && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm act-main"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.date, l.serviceType, "open")}
                            >
                              Open now
                            </button>
                          )}
                          {l.status === "open" && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm act-main"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.date, l.serviceType, "closed")}
                            >
                              Close now
                            </button>
                          )}
                          {l.override !== null && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm act-reset"
                              disabled={busy}
                              onClick={() => setOverride(loc.locationId, l.date, l.serviceType, null)}
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
      </div>
      {snapshot.locations.length === 0 && <p className="muted">There are no active churches.</p>}
    </div>
  );
}
