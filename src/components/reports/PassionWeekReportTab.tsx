"use client";

import { useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { PWOverview } from "@/lib/repo/passionWeek";
import { PW_SERVICES, PW_ACTIVITIES, pwHoursFor, pwSlotCount, type PWServiceId } from "@/lib/constants";
import { getPassionWeekFullScheduleAction } from "@/app/(app)/reports/actions";

export default function PassionWeekReportTab({
  locations,
  initialYear,
}: {
  locations: LocationRow[];
  initialYear: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [schedule, setSchedule] = useState<Record<PWServiceId, PWOverview> | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleView() {
    if (!locationId) return;
    setLoading(true);
    setSchedule(await getPassionWeekFullScheduleAction(year, locationId));
    setLoading(false);
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
                      {PW_ACTIVITIES.map((act) => (
                        <th key={act.id}>{act.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((h) => (
                      <tr key={h}>
                        <td>{h}</td>
                        {PW_ACTIVITIES.map((act) => {
                          const slots = pwSlotCount(svc.id, act.id);
                          const names = Array.from({ length: slots })
                            .map((_, i) => overview[h]?.[act.id]?.[i]?.name)
                            .filter(Boolean);
                          return <td key={act.id}>{names.length > 0 ? names.join(", ") : "—"}</td>;
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
