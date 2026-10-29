"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlagRow } from "@/lib/repo/checkinReview";
import { describeFlag, methodLabel } from "@/lib/flagReasons";
import { weekdayLabel } from "@/lib/timezone";
import { deleteReviewedFlagAction, resolveFlagAction } from "@/lib/actions/checkinReview";

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

  async function remove(flag: FlagRow) {
    if (
      !window.confirm(
        `Remove this record for good? ${flag.deaconName}'s ${flag.status} check-in at ${flag.locationName} will disappear from this list. This can't be undone.`
      )
    ) {
      return;
    }
    setBusyId(flag.id);
    setError(null);
    const res = await deleteReviewedFlagAction(flag.id);
    setBusyId(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {error &&<p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      <div className="card roomy">
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
            <table className="table table-flush-end table-stack table-review">
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
                    <td className="stack-title r-who">
                      {f.deaconName}
                      <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 400 }}>
                        {f.recentCount} flagged in the last 90 days
                      </div>
                    </td>
                    <td data-label="Liturgy" className="r-where">
                      {f.locationName}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {weekdayLabel(f.date)}, {f.date} · {f.serviceLabel}
                      </div>
                    </td>
                    <td data-label="How" className="r-side">
                      {methodLabel(f.method)}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>{f.createdLabel}</div>
                    </td>
                    <td data-label="Why it's here" className="r-why">{describeFlag(f)}</td>
                    <td className="stack-actions">
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
        <div className="card roomy">
          <h3 style={{ marginTop: 0 }}>Recently reviewed</h3>
          <div className="table-wrap">
            <table className="table table-flush-end table-stack table-review">
              <thead>
                <tr>
                  <th>Deacon</th>
                  <th>Liturgy</th>
                  <th>Why it was flagged</th>
                  <th>Decision</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((f) => (
                  <tr key={f.id}>
                    <td className="stack-title r-who">{f.deaconName}</td>
                    <td data-label="Liturgy" className="r-where">
                      {f.locationName}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {weekdayLabel(f.date)}, {f.date} · {f.serviceLabel} · {methodLabel(f.method)}
                      </div>
                    </td>
                    <td data-label="Why it was flagged" className="r-why">{describeFlag(f)}</td>
                    <td data-label="Decision" className="r-side">
                      <span className={f.status === "confirmed" ? "badge badge-green" : "badge badge-grey"}>
                        {f.status === "confirmed" ? "Confirmed" : "Rejected"}
                      </span>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                        {f.resolvedByName ? `${f.resolvedByName} · ` : ""}
                        {f.resolvedLabel}
                      </div>
                    </td>
                    <td className="stack-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busyId === f.id}
                        onClick={() => remove(f)}
                      >
                        Remove
                      </button>
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
