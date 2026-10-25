"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationRow } from "@/lib/repo/locations";
import type { StartTimeCell } from "@/lib/repo/liturgySchedule";
import { SERVICE_TYPES, SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import { WEEKDAY_NAMES } from "@/lib/timezone";
import { setStartTimesForDayAction } from "@/app/(app)/settings/actions";

type DayTimes = Record<ServiceTypeCode, string>;

function draftsFor(cells: StartTimeCell[]): Record<number, DayTimes> {
  const out: Record<number, DayTimes> = {};
  for (const c of cells) {
    out[c.weekday] = { ...(out[c.weekday] ?? ({} as DayTimes)), [c.serviceType]: c.time };
  }
  return out;
}

/** The start time of every liturgy, per church and weekday -- check-in opens 30 minutes before each one. */
export default function LiturgyStartTimesCard({
  locations,
  startTimesByLocation,
  canEdit,
}: {
  locations: LocationRow[];
  startTimesByLocation: Record<string, StartTimeCell[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const active = locations.filter((l) => l.status === "Active");
  const [locationId, setLocationId] = useState(active[0]?.id ?? "");
  const [drafts, setDrafts] = useState(() => draftsFor(startTimesByLocation[active[0]?.id ?? ""] ?? []));
  const [error, setError] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const cells = startTimesByLocation[locationId] ?? [];

  function selectLocation(id: string) {
    setLocationId(id);
    setDrafts(draftsFor(startTimesByLocation[id] ?? []));
    setError(null);
  }

  async function save(weekday: number) {
    setSavingDay(weekday);
    setError(null);
    const result = await setStartTimesForDayAction(locationId, weekday, drafts[weekday]);
    setSavingDay(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const isDefault = (weekday: number, s: ServiceTypeCode) =>
    cells.find((c) => c.weekday === weekday && c.serviceType === s)?.isDefault ?? true;

  return (
    <div className="card">
      <h3>Liturgy Start Times</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        When each liturgy starts, for each church and day of the week. Check-in for a liturgy opens 30 minutes before it
        starts and closes when the next one opens (or about 3 hours after it starts). A liturgy added as an extra takes
        the time for its position on that day, so the 3rd Liturgy time is used on days with a third liturgy. Times marked
        &ldquo;default&rdquo; are placeholders — press Save on a day to confirm its times.
      </p>
      <div className="field" style={{ maxWidth: 320, marginBottom: "1rem" }}>
        <label>Location</label>
        <select value={locationId} onChange={(e) => selectLocation(e.target.value)}>
          {active.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Day</th>
              {SERVICE_TYPES.map((s) => (
                <th key={s}>{SERVICE_LABELS[s]}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_NAMES.map((name, weekday) => (
              <tr key={weekday}>
                <td>{name}</td>
                {SERVICE_TYPES.map((s) => (
                  <td key={s}>
                    <input
                      type="time"
                      value={drafts[weekday]?.[s] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [weekday]: { ...d[weekday], [s]: e.target.value } }))
                      }
                    />
                    {isDefault(weekday, s) && (
                      <div className="muted" style={{ fontSize: "0.75rem" }}>default</div>
                    )}
                  </td>
                ))}
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canEdit || savingDay === weekday}
                    onClick={() => save(weekday)}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canEdit && <p className="muted" style={{ marginTop: "0.5rem" }}>Only a System Admin can make changes here.</p>}
    </div>
  );
}
