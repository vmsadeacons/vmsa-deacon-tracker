"use client";

import { useEffect, useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { PWOverview } from "@/lib/repo/passionWeek";
import {
  PW_SERVICES,
  PW_ACTIVITIES,
  pwHoursFor,
  pwSlotCount,
  type PWServiceId,
  type PWActivityId,
} from "@/lib/constants";
import { getPassionWeekOverviewAction, setPassionWeekAssignmentAction } from "@/app/(app)/passion-week/actions";

export default function PassionWeekClient({
  locations,
  deacons,
  initialYear,
}: {
  locations: LocationRow[];
  deacons: DeaconWithAgeGroup[];
  initialYear: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<PWServiceId>(PW_SERVICES[0].id);
  const [hour, setHour] = useState<string>(pwHoursFor(PW_SERVICES[0].id)[0]);
  const [overview, setOverview] = useState<PWOverview>({});
  const [loading, setLoading] = useState(false);

  const hours = pwHoursFor(serviceId);

  async function load(y: number, l: string, s: PWServiceId) {
    if (!l) return;
    setLoading(true);
    const result = await getPassionWeekOverviewAction(y, l, s);
    setOverview(result);
    setLoading(false);
  }

  useEffect(() => {
    // Initial fetch on mount — standard data-fetching effect (React docs'
    // own "Fetching data" pattern), not a render-time state update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(year, locationId, serviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServiceChange(s: PWServiceId) {
    setServiceId(s);
    setHour(pwHoursFor(s)[0]);
    load(year, locationId, s);
  }

  function handleYearOrLocationChange(y: number, l: string) {
    setYear(y);
    setLocationId(l);
    load(y, l, serviceId);
  }

  function deaconOptions(currentDeaconId: string | undefined) {
    return deacons.filter((d) => d.status === "Active" || d.id === currentDeaconId);
  }

  async function handleAssign(activityId: PWActivityId, slotIndex: number, deaconId: string) {
    const result = await setPassionWeekAssignmentAction({
      year,
      locationId,
      serviceId,
      hour,
      activityId,
      slotIndex,
      deaconId: deaconId || null,
    });
    setOverview(result);
  }

  return (
    <div>
      <h1>Passion Week</h1>

      <div className="card">
        <div className="step-header">1 · Which service?</div>
        <div className="fieldrow">
          <div className="field">
            <label>Holy Week year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => handleYearOrLocationChange(Number(e.target.value), locationId)}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <select value={locationId} onChange={(e) => handleYearOrLocationChange(year, e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Service</label>
            <select value={serviceId} onChange={(e) => handleServiceChange(e.target.value as PWServiceId)}>
              {PW_SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="step-header">2 · Hour</div>
        <div className="chip-row">
          {hours.map((h) => (
            <button key={h} type="button" className={`chip ${hour === h ? "active" : ""}`} onClick={() => setHour(h)}>
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="step-header">3 · Assignments — {hour} hour</div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="grid-2">
            {PW_ACTIVITIES.map((act) => {
              const slots = pwSlotCount(serviceId, act.id);
              return (
                <div key={act.id} className="card" style={{ marginBottom: 0 }}>
                  <div className="step-header">{act.label}</div>
                  {Array.from({ length: slots }).map((_, slotIndex) => {
                    const current = overview[hour]?.[act.id]?.[slotIndex]?.deaconId ?? "";
                    return (
                      <div key={slotIndex} className="field" style={{ marginBottom: slots > 1 ? "0.5rem" : 0 }}>
                        {slots > 1 && <label>Reading {slotIndex + 1}</label>}
                        <select value={current} onChange={(e) => handleAssign(act.id, slotIndex, e.target.value)}>
                          <option value="">— none —</option>
                          {deaconOptions(current || undefined).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Service overview — all hours</h3>
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
                    const slots = pwSlotCount(serviceId, act.id);
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
    </div>
  );
}
