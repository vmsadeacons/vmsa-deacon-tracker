"use client";

import { useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { PWOverview } from "@/lib/repo/passionWeek";
import type { PWActivityRow } from "@/lib/repo/passionWeekActivities";
import { PW_SERVICES, pwHoursFor, pwSlotCount, type PWServiceId } from "@/lib/constants";
import { getPassionWeekFullScheduleAction } from "@/app/(app)/reports/actions";
import { useLatestRequest } from "@/lib/useLatestRequest";

export default function PassionWeekReportTab({
  locations,
  initialYear,
  pwActivities,
}: {
  locations: LocationRow[];
  initialYear: number;
  pwActivities: PWActivityRow[];
}) {
  const activities = [...pwActivities].sort((a, b) => a.sort_order - b.sort_order);
  const [year, setYear] = useState(initialYear);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [schedule, setSchedule] = useState<Record<PWServiceId, PWOverview> | null>(null);
  const [loading, setLoading] = useState(false);
  const runLatest = useLatestRequest<Record<PWServiceId, PWOverview>>();

  function handleView() {
    if (!locationId) return;
    setLoading(true);
    runLatest(getPassionWeekFullScheduleAction(year, locationId), (res) => {
      setSchedule(res);
      setLoading(false);
    });
  }

  return (
    <div>
      <div className="card">
        <div className="fieldrow">
          <div className="field">
            <label>Holy Week year</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={handleView}>
          View
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {schedule &&
        !loading &&
        PW_SERVICES.map((svc) => {
          const overview = schedule[svc.id];
          const hours = pwHoursFor(svc.id);
          return (
            <div key={svc.id} className="card">
              <h3>{svc.label}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hour</th>
                      {activities.map((act) => (
                        <th key={act.code}>{act.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((h) => (
                      <tr key={h}>
                        <td>{h}</td>
                        {activities.map((act) => {
                          const slots = pwSlotCount(svc.id, act.code);
                          const names = Array.from({ length: slots })
                            .map((_, i) => overview[h]?.[act.code]?.[i]?.name)
                            .filter(Boolean);
                          return <td key={act.code}>{names.length > 0 ? names.join(", ") : "—"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}
