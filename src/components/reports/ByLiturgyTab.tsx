"use client";

import { useEffect, useState } from "react";
import LiturgyPicker from "@/components/LiturgyPicker";
import type { LocationRow } from "@/lib/repo/locations";
import type { LiturgyContext } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";
import { getLiturgyReportAction } from "@/app/(app)/reports/actions";

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

  async function load(d: string, l: string, s: ServiceTypeCode) {
    if (!l) return;
    setLoading(true);
    setResult(await getLiturgyReportAction(d, l, s));
    setLoading(false);
  }

  useEffect(() => {
    // Initial fetch on mount — standard data-fetching effect, not a
    // render-time state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(date, locationId, serviceType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(d: string, l: string, s: ServiceTypeCode) {
    setDate(d);
    setLocationId(l);
    setServiceType(s);
    load(d, l, s);
  }

  return (
    <div>
      <div className="card">
        <LiturgyPicker date={date} locationId={locationId} serviceType={serviceType} locations={locations} onChange={handleChange} />
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && !result && (
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
