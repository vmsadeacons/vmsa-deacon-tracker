"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationRow } from "@/lib/repo/locations";
import type { StartTimeCell } from "@/lib/repo/liturgySchedule";
import { WEEKDAY_NAMES } from "@/lib/timezone";
import { describeMinutes } from "@/lib/formatTime";
import { setStartTimesForDayAction } from "@/lib/actions/schedule";

type DayTimes = { S1: string; S2?: string };

function draftsFor(cells: StartTimeCell[]): Record<number, DayTimes> {
  const out: Record<number, DayTimes> = {};
  for (const c of cells) {
    out[c.weekday] = { ...(out[c.weekday] ?? { S1: "" }), [c.serviceType]: c.time };
  }
  return out;
}

/** When each church's regular liturgies start: one on every day, two on Sunday. Extras have their own times (see Extra Liturgies). */
export default function LiturgyStartTimesCard({
  locations,
  startTimesByLocation,
  openBefore,
}: {
  locations: LocationRow[];
  startTimesByLocation: Record<string, StartTimeCell[]>;
  openBefore: number;
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

  const isDefault = (weekday: number, s: "S1" | "S2") =>
    cells.find((c) => c.weekday === weekday && c.serviceType === s)?.isDefault ?? true;

  return (
    <div className="card">
      <h3>Liturgy Start Times</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        When each church&apos;s regular liturgies start: one on every day, and two on Sunday. Check-in for a liturgy opens{" "}
        {describeMinutes(openBefore)} before it starts. An extra liturgy has its own start time, set when it&apos;s added.
        Times marked &ldquo;default&rdquo; are placeholders — press Save on a day to confirm its times.
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
              <th>1st Liturgy</th>
              <th>2nd Liturgy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_NAMES.map((name, weekday) => (
              <tr key={weekday}>
                <td>{name}</td>
                <td>
                  <input
                    type="time"
                    value={drafts[weekday]?.S1 ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [weekday]: { ...d[weekday], S1: e.target.value } }))}
                  />
                  {isDefault(weekday, "S1") && <div className="muted" style={{ fontSize: "0.75rem" }}>default</div>}
                </td>
                <td>
                  {weekday === 0 ? (
                    <>
                      <input
                        type="time"
                        value={drafts[weekday]?.S2 ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [weekday]: { ...d[weekday], S2: e.target.value } }))}
                      />
                      {isDefault(weekday, "S2") && <div className="muted" style={{ fontSize: "0.75rem" }}>default</div>}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" disabled={savingDay === weekday} onClick={() => save(weekday)}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
