"use client";

import { useState } from "react";
import LiturgyPicker from "@/components/LiturgyPicker";
import type { LocationRow } from "@/lib/repo/locations";
import type { LiturgyContext } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";
import { getLiturgyReportAction } from "@/app/(app)/reports/actions";
import { useLatestRequest } from "@/lib/useLatestRequest";

export default function ByLiturgyTab({
  locations,
  initialDate,
  initialLocationId,
  initialServiceType,
}: {
  locations: LocationRow[];
  initialDate: string;
  initialLocationId: string;
  initialServiceType: ServiceTypeCode;
}) {
  const [date, setDate] = useState(initialDate);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [serviceType, setServiceType] = useState(initialServiceType);
  const [result, setResult] = useState<(LiturgyContext & { archived: boolean }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const runLatest = useLatestRequest<(LiturgyContext & { archived: boolean }) | null>();

  function handleView() {
    if (!locationId) return;
    setLoading(true);
    setHasSearched(true);
    runLatest(getLiturgyReportAction(date, locationId, serviceType), (res) => {
      setResult(res);
      setLoading(false);
    });
  }

  function handleChange(d: string, l: string, s: ServiceTypeCode) {
    setDate(d);
    setLocationId(l);
    setServiceType(s);
  }

  return (
    <div>
      <div className="card">
        <LiturgyPicker date={date} locationId={locationId} serviceType={serviceType} locations={locations} onChange={handleChange} />
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={handleView}>
          View
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && hasSearched && !result && (
        <div className="card">
          <p className="muted">No liturgy recorded for this date, location, and service.</p>
        </div>
      )}

      {!loading && result && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>Attendees ({result.attendees.length})</h3>
            {result.archived && <span className="badge badge-amber">(archived)</span>}
          </div>
          <div className="chip-row" style={{ marginBottom: "1.25rem" }}>
            {result.attendees.map((a) => (
              <span key={a.deaconId} className="badge badge-green">
                {a.name}
              </span>
            ))}
          </div>
          <h3>Activity assignments</h3>
          {result.assignments.length === 0 ? (
            <p className="muted">None recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Deacon(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.assignments.map((a) => (
                    <tr key={a.activityId}>
                      <td>{a.activityName}</td>
                      <td>
                        {a.deaconIds
                          .map((id) => result.attendees.find((att) => att.deaconId === id)?.name ?? "?")
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
