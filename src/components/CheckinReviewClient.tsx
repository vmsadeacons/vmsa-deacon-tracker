"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlagRow } from "@/lib/repo/checkinReview";
import { describeFlag, methodLabel } from "@/lib/flagReasons";
import { weekdayLabel } from "@/lib/timezone";
import { resolveFlagAction } from "@/lib/actions/checkinReview";

/** The pending flagged check-ins, each with Confirm / Reject, and the most recently reviewed ones below. */
export default function CheckinReviewClient({ pending, reviewed }: { pending: FlagRow[]; reviewed: FlagRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(flag: FlagRow, action: "confirm" | "reject") {
    if (
      action === "reject" &&
      !window.confirm(`Reject this check-in? ${flag.deaconName} will be removed from the attendance for ${flag.locationName}.`)
    ) {
      return;
    }
    setBusyId(flag.id);
    setError(null);
    const res = await resolveFlagAction(flag.id, action);
    setBusyId(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          To review{" "}
          {pending.length > 0 && (
            <span className="badge badge-amber" style={{ marginLeft: "0.4rem" }}>{pending.length}</span>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="muted">Nothing to review — every check-in was confirmed to be at the church.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table-flush-end">
              <thead>
                <tr>
                  <th>Deacon</th>
                  <th>Liturgy</th>
                  <th>How</th>
                  <th>Why it&apos;s here</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.deaconName}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {f.recentCount} flagged in the last 90 days
                      </div>
                    </td>
                    <td>
                      {f.locationName}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {weekdayLabel(f.date)}, {f.date} · {f.serviceLabel}
                      </div>
                    </td>
                    <td>
                      {methodLabel(f.method)}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>{f.createdLabel}</div>
                    </td>
                    <td>{describeFlag(f)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === f.id}
                          onClick={() => resolve(f, "confirm")}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busyId === f.id}
                          onClick={() => resolve(f, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recently reviewed</h3>
          <div className="table-wrap">
            <table className="table table-flush-end">
              <thead>
                <tr>
                  <th>Deacon</th>
                  <th>Liturgy</th>
                  <th>Why it was flagged</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((f) => (
                  <tr key={f.id}>
                    <td>{f.deaconName}</td>
                    <td>
                      {f.locationName}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {weekdayLabel(f.date)}, {f.date} · {f.serviceLabel} · {methodLabel(f.method)}
                      </div>
                    </td>
                    <td>{describeFlag(f)}</td>
                    <td>
                      <span className={f.status === "confirmed" ? "badge badge-green" : "badge badge-grey"}>
                        {f.status === "confirmed" ? "Confirmed" : "Rejected"}
                      </span>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                        {f.resolvedByName ? `${f.resolvedByName} · ` : ""}
                        {f.resolvedLabel}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
