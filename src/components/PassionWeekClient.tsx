"use client";

import { useEffect, useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { DeaconLite } from "@/lib/repo/deacons";
import type { PWOverview } from "@/lib/repo/passionWeek";
import type { PWActivityRow } from "@/lib/repo/passionWeekActivities";
import { PW_SERVICES, pwHoursFor, pwSlotCount, type PWServiceId, type PWActivityId } from "@/lib/constants";
import { getPassionWeekOverviewAction, setPassionWeekAssignmentAction } from "@/app/(app)/passion-week/actions";
import { useLatestRequest } from "@/lib/useLatestRequest";
import SingleRosterPickerModal from "./SingleRosterPickerModal";

export default function PassionWeekClient({
  locations,
  deacons,
  initialYear,
  pwActivities,
}: {
  locations: LocationRow[];
  deacons: DeaconLite[];
  initialYear: number;
  pwActivities: PWActivityRow[];
}) {
  const [year, setYear] = useState(initialYear);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [serviceId, setServiceId] = useState<PWServiceId>(PW_SERVICES[0].id);
  const [hour, setHour] = useState<string>(pwHoursFor(PW_SERVICES[0].id)[0]);
  const [overview, setOverview] = useState<PWOverview>({});
  const [loading, setLoading] = useState(false);
  const runLatest = useLatestRequest<PWOverview>();

  const hours = pwHoursFor(serviceId);
  // Overview/history shows every activity regardless of status, so a
  // deactivated one's past assignments stay visible; new entry only offers
  // active ones.
  const activities = [...pwActivities].sort((a, b) => a.sort_order - b.sort_order);
  const activeActivities = activities.filter((a) => a.status === "Active");

  function load(y: number, l: string, s: PWServiceId) {
    if (!l) return;
    setLoading(true);
    runLatest(getPassionWeekOverviewAction(y, l, s), (result) => {
      setOverview(result);
      setLoading(false);
    });
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

  function handleAssign(activityId: PWActivityId, slotIndex: number, deaconId: string | null) {
    runLatest(
      setPassionWeekAssignmentAction({
        year,
        locationId,
        serviceId,
        hour,
        activityId,
        slotIndex,
        deaconId,
      }),
      setOverview
    );
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
            {activeActivities.map((act) => {
              const slots = pwSlotCount(serviceId, act.code);
              return (
                <div key={act.code} className="card" style={{ marginBottom: 0 }}>
                  <div className="step-header">{act.label}</div>
                  {Array.from({ length: slots }).map((_, slotIndex) => {
                    const current = overview[hour]?.[act.code]?.[slotIndex]?.deaconId ?? "";
                    return (
                      <div key={slotIndex} className="field" style={{ marginBottom: slots > 1 ? "0.5rem" : 0 }}>
                        {slots > 1 && <label>Reading {slotIndex + 1}</label>}
                        <SingleRosterPickerModal
                          items={deaconOptions(current || undefined).map((d) => ({
                            id: d.id,
                            name: d.name,
                            firstName: d.first_name,
                            lastName: d.last_name,
                          }))}
                          selectedId={current || null}
                          onSelect={(id) => handleAssign(act.code, slotIndex, id)}
                          title={`${act.label} — choose a deacon`}
                          idPrefix={`pw-${act.code}-${slotIndex}`}
                        />
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
                    const slots = pwSlotCount(serviceId, act.code);
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
    </div>
  );
}
