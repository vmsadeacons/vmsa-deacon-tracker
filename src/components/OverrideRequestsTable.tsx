"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OverrideRequestRow } from "@/lib/repo/publicProfile";
import { decideOverrideRequestAction } from "@/app/(app)/member-updates/actions";

export default function OverrideRequestsTable({ requests }: { requests: OverrideRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const result = await decideOverrideRequestAction(id, approve);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  if (requests.length === 0) {
    return <p className="muted">No override requests.</p>;
  }

  return (
    <div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {pending.length === 0 ? (
        <p className="muted" style={{ marginBottom: "1.25rem" }}>No pending requests.</p>
      ) : (
        <div className="table-wrap" style={{ marginBottom: "1.25rem" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Field</th>
                <th>Current</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/deacons?edit=${r.deaconId}`}>{r.deaconName}</Link>
                  </td>
                  <td>{r.fieldLabel}</td>
                  <td>{r.currentDisplay || "—"}</td>
                  <td>{r.requestedDisplay || "—"}</td>
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, true)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, false)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {decided.length > 0 && (
        <details>
          <summary className="muted" style={{ cursor: "pointer", marginBottom: "0.5rem" }}>
            {decided.length} decided request{decided.length === 1 ? "" : "s"}
          </summary>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Field</th>
                  <th>Current</th>
                  <th>Requested</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/deacons?edit=${r.deaconId}`}>{r.deaconName}</Link>
                    </td>
                    <td>{r.fieldLabel}</td>
                    <td>{r.currentDisplay || "—"}</td>
                    <td>{r.requestedDisplay || "—"}</td>
                    <td>
                      <span className={`badge ${r.status === "approved" ? "badge-green" : "badge-grey"}`}>
                        {r.status === "approved" ? "Approved" : "Rejected"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
