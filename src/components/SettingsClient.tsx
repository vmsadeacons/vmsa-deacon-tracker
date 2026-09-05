"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LocationRow } from "@/lib/repo/locations";
import type { ActivityRow } from "@/lib/repo/activities";
import type { AppSettings } from "@/lib/repo/settings";
import type { PWActivityRow } from "@/lib/repo/passionWeekActivities";
import type { RankRow } from "@/lib/repo/ranks";
import type { FeastNameRow } from "@/lib/repo/feastNames";
import type { DayFilterOptionRow } from "@/lib/repo/dayFilterOptions";
import type { CutoffRow } from "@/lib/repo/liturgyTimeCutoffs";
import { WEEKDAY_NAMES } from "@/lib/timezone";
import {
  createLocationAction,
  updateLocationAction,
  setLocationGeofenceAction,
  setCutoffAction,
  createActivityAction,
  updateActivityAction,
  setAgeGroupThresholdsAction,
  setSuggestionSettingsAction,
  updatePWActivityAction,
  createRankAction,
  updateRankAction,
  createFeastNameAction,
  updateFeastNameAction,
  createDayFilterOptionAction,
  updateDayFilterOptionAction,
  deleteDayFilterOptionAction,
} from "@/app/(app)/settings/actions";

function ViewOnlyNote() {
  return <p className="muted" style={{ marginTop: "0.5rem" }}>Only a System Admin can make changes here.</p>;
}

function LocationsCard({ locations, canEdit }: { locations: LocationRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState(Object.fromEntries(locations.map((l) => [l.id, l.name])));

  async function add() {
    if (!newName.trim()) return;
    await createLocationAction(newName.trim());
    setNewName("");
    router.refresh();
  }

  async function saveDraft(id: string) {
    await updateLocationAction(id, { name: drafts[id] });
    router.refresh();
  }

  async function toggleStatus(loc: LocationRow) {
    await updateLocationAction(loc.id, { status: loc.status === "Active" ? "Inactive" : "Active" });
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Locations</h3>
      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    value={drafts[l.id] ?? l.name}
                    disabled={!canEdit}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                  />
                </td>
                <td>
                  <span className={`badge ${l.status === "Active" ? "badge-green" : "badge-grey"}`}>{l.status}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(l.id)}>
                    Save
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => toggleStatus(l)}>
                    {l.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="New location name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function ActivitiesCard({ activities, canEdit }: { activities: ActivityRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [allowsMultiple, setAllowsMultiple] = useState(false);
  const sorted = [...activities].sort((a, b) => a.sort_order - b.sort_order);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(sorted.map((a) => [a.id, { name: a.name, sortOrder: a.sort_order }]))
  );

  async function add() {
    if (!newName.trim()) return;
    await createActivityAction(newName.trim(), allowsMultiple);
    setNewName("");
    setAllowsMultiple(false);
    router.refresh();
  }

  async function saveDraft(id: string) {
    const draft = drafts[id];
    await updateActivityAction(id, { name: draft.name, sortOrder: draft.sortOrder });
    router.refresh();
  }

  async function toggleStatus(a: ActivityRow) {
    await updateActivityAction(a.id, { status: a.status === "Active" ? "Inactive" : "Active" });
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Liturgy Activities</h3>
      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Order</th>
              <th>Allows multiple</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id}>
                <td>
                  <input
                    value={drafts[a.id]?.name ?? a.name}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [a.id]: { ...d[a.id], name: e.target.value } }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70 }}
                    value={drafts[a.id]?.sortOrder ?? a.sort_order}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [a.id]: { ...d[a.id], sortOrder: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>{a.allows_multiple ? "Yes" : "No"}</td>
                <td>
                  <span className={`badge ${a.status === "Active" ? "badge-green" : "badge-grey"}`}>{a.status}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(a.id)}>
                    Save
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => toggleStatus(a)}>
                    {a.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input placeholder="New activity name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={allowsMultiple} onChange={(e) => setAllowsMultiple(e.target.checked)} />
            Allows multiple
          </label>
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function RanksCard({ ranks, canEdit }: { ranks: RankRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const sorted = [...ranks].sort((a, b) => a.sort_order - b.sort_order);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(sorted.map((r) => [r.id, { name: r.name, sortOrder: r.sort_order }]))
  );

  async function add() {
    if (!newName.trim()) return;
    await createRankAction(newName.trim());
    setNewName("");
    router.refresh();
  }

  async function saveDraft(id: string) {
    const draft = drafts[id];
    await updateRankAction(id, { name: draft.name, sortOrder: draft.sortOrder });
    router.refresh();
  }

  async function toggleStatus(r: RankRow) {
    await updateRankAction(r.id, { status: r.status === "Active" ? "Inactive" : "Active" });
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Ranks</h3>
      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Order</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    value={drafts[r.id]?.name ?? r.name}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], name: e.target.value } }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70 }}
                    value={drafts[r.id]?.sortOrder ?? r.sort_order}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [r.id]: { ...d[r.id], sortOrder: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>
                  <span className={`badge ${r.status === "Active" ? "badge-green" : "badge-grey"}`}>{r.status}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(r.id)}>
                    Save
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => toggleStatus(r)}>
                    {r.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="New rank name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function DayCheckboxes({
  weekdays,
  isSpecialFeast,
  disabled,
  onChange,
}: {
  weekdays: number[];
  isSpecialFeast: boolean;
  disabled: boolean;
  onChange: (weekdays: number[], isSpecialFeast: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {WEEKDAY_NAMES.map((name, i) => (
        <label key={i} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            disabled={disabled || isSpecialFeast}
            checked={weekdays.includes(i)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...weekdays, i].sort((a, b) => a - b)
                : weekdays.filter((d) => d !== i);
              onChange(next, false);
            }}
          />
          {name.slice(0, 3)}
        </label>
      ))}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.85rem",
          marginLeft: "0.5rem",
        }}
      >
        <input
          type="checkbox"
          disabled={disabled}
          checked={isSpecialFeast}
          onChange={(e) => onChange(e.target.checked ? [] : weekdays, e.target.checked)}
        />
        Special Feast
      </label>
    </div>
  );
}

function DayFiltersCard({
  dayFilterOptions,
  canEdit,
}: {
  dayFilterOptions: DayFilterOptionRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sorted = [...dayFilterOptions].sort((a, b) => a.sort_order - b.sort_order);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(
      sorted.map((o) => [
        o.id,
        { label: o.label, weekdays: o.weekdays, isSpecialFeast: o.is_special_feast, sortOrder: o.sort_order },
      ])
    )
  );
  const [newLabel, setNewLabel] = useState("");
  const [newWeekdays, setNewWeekdays] = useState<number[]>([]);
  const [newIsSpecialFeast, setNewIsSpecialFeast] = useState(false);

  async function add() {
    if (!newLabel.trim()) return;
    if (!newIsSpecialFeast && newWeekdays.length === 0) {
      setError("Pick at least one day, or mark it as Special Feast.");
      return;
    }
    setError(null);
    const result = await createDayFilterOptionAction(newLabel.trim(), newWeekdays, newIsSpecialFeast);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewLabel("");
    setNewWeekdays([]);
    setNewIsSpecialFeast(false);
    router.refresh();
  }

  async function saveDraft(id: string) {
    const draft = drafts[id];
    if (!draft.isSpecialFeast && draft.weekdays.length === 0) {
      setError("Pick at least one day, or mark it as Special Feast.");
      return;
    }
    setError(null);
    const result = await updateDayFilterOptionAction(id, {
      label: draft.label,
      weekdays: draft.weekdays,
      isSpecialFeast: draft.isSpecialFeast,
      sortOrder: draft.sortOrder,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function remove(o: DayFilterOptionRow) {
    if (!confirm(`Delete the "${o.label}" day filter? This can't be undone.`)) return;
    await deleteDayFilterOptionAction(o.id);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Day Filters</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        These options power the Day filter on Reports → Summary. Add any day combination you need,
        or delete ones you don&apos;t.
      </p>
      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Days</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => {
              const draft =
                drafts[o.id] ??
                { label: o.label, weekdays: o.weekdays, isSpecialFeast: o.is_special_feast, sortOrder: o.sort_order };
              return (
                <tr key={o.id}>
                  <td>
                    <input
                      value={draft.label}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [o.id]: { ...draft, label: e.target.value } }))
                      }
                    />
                  </td>
                  <td>
                    <DayCheckboxes
                      weekdays={draft.weekdays}
                      isSpecialFeast={draft.isSpecialFeast}
                      disabled={!canEdit}
                      onChange={(weekdays, isSpecialFeast) =>
                        setDrafts((d) => ({ ...d, [o.id]: { ...draft, weekdays, isSpecialFeast } }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 70 }}
                      value={draft.sortOrder}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [o.id]: { ...draft, sortOrder: Number(e.target.value) } }))
                      }
                    />
                  </td>
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(o.id)}>
                      Save
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => remove(o)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {canEdit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              placeholder="New filter label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{ flex: "1 1 220px" }}
            />
            <button className="btn btn-primary" onClick={add}>
              Add
            </button>
          </div>
          <DayCheckboxes
            weekdays={newWeekdays}
            isSpecialFeast={newIsSpecialFeast}
            disabled={false}
            onChange={(weekdays, isSpecialFeast) => {
              setNewWeekdays(weekdays);
              setNewIsSpecialFeast(isSpecialFeast);
            }}
          />
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function FeastNamesCard({ feastNames, canEdit }: { feastNames: FeastNameRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sorted = [...feastNames].sort((a, b) => a.sort_order - b.sort_order);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(sorted.map((f) => [f.id, { name: f.name, sortOrder: f.sort_order }]))
  );

  async function add() {
    if (!newName.trim()) return;
    setError(null);
    const result = await createFeastNameAction(newName.trim());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function saveDraft(id: string) {
    const draft = drafts[id];
    setError(null);
    const result = await updateFeastNameAction(id, { name: draft.name, sortOrder: draft.sortOrder });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function toggleStatus(f: FeastNameRow) {
    await updateFeastNameAction(f.id, { status: f.status === "Active" ? "Inactive" : "Active" });
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Feast Names</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        The Special Feast dropdown on Record a Liturgy only ever offers names from this list, so
        every admin records the same feast the same way. Renaming one here updates it everywhere
        it&apos;s already been recorded.
      </p>
      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Order</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <tr key={f.id}>
                <td>
                  <input
                    value={drafts[f.id]?.name ?? f.name}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [f.id]: { ...d[f.id], name: e.target.value } }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70 }}
                    value={drafts[f.id]?.sortOrder ?? f.sort_order}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [f.id]: { ...d[f.id], sortOrder: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>
                  <span className={`badge ${f.status === "Active" ? "badge-green" : "badge-grey"}`}>{f.status}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(f.id)}>
                    Save
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => toggleStatus(f)}>
                    {f.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {canEdit ? (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="New feast name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function ServiceSuggestionsCard({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const [windowMonths, setWindowMonths] = useState(settings.suggestionWindowMonths);
  const [minAttendance, setMinAttendance] = useState(settings.suggestionMinAttendance);
  const [error, setError] = useState<string | null>(null);

  const valid = Number.isInteger(windowMonths) && windowMonths >= 1 && Number.isInteger(minAttendance) && minAttendance >= 1;

  async function save() {
    setError(null);
    const result = await setSuggestionSettingsAction(windowMonths, minAttendance);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Service Suggestions based on historical % participation</h3>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        On Record a Liturgy, the Altar Service and Readings sections suggest whoever currently
        attending has the lowest historical participation, so service rotates fairly.
      </p>
      <div className="grid-2" style={{ marginBottom: "0.75rem" }}>
        <div className="field">
          <label>Rolling window (months)</label>
          <input
            type="number"
            min={1}
            disabled={!canEdit}
            value={windowMonths}
            onChange={(e) => setWindowMonths(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Minimum attendances to qualify</label>
          <input
            type="number"
            min={1}
            disabled={!canEdit}
            value={minAttendance}
            onChange={(e) => setMinAttendance(Number(e.target.value))}
          />
        </div>
      </div>
      {!valid && <p className="error-text" style={{ marginBottom: "0.75rem" }}>Both values must be whole numbers of at least 1.</p>}
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {canEdit ? (
        <button className="btn btn-primary" disabled={!valid} onClick={save}>
          Save
        </button>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function AgeGroupsCard({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const router = useRouter();
  const [youthMin, setYouthMin] = useState(settings.ageGroupYouthMin);
  const [adultMin, setAdultMin] = useState(settings.ageGroupAdultMin);
  const [error, setError] = useState<string | null>(null);

  const valid = youthMin >= 0 && adultMin >= 0 && youthMin < adultMin;

  async function save() {
    setError(null);
    const result = await setAgeGroupThresholdsAction(youthMin, adultMin);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Age groupings</h3>
      <div className="grid-2" style={{ marginBottom: "0.75rem" }}>
        <div className="field">
          <label>Youth starts at (years)</label>
          <input
            type="number"
            min={0}
            disabled={!canEdit}
            value={youthMin}
            onChange={(e) => setYouthMin(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Adult starts at (years)</label>
          <input
            type="number"
            min={0}
            disabled={!canEdit}
            value={adultMin}
            onChange={(e) => setAdultMin(Number(e.target.value))}
          />
        </div>
      </div>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        Preview: Child (0–{Math.max(youthMin - 1, 0)}) · Youth ({youthMin}–{Math.max(adultMin - 1, youthMin)}) · Adult (
        {adultMin}+)
      </p>
      {!valid && <p className="error-text" style={{ marginBottom: "0.75rem" }}>Youth threshold must be non-negative and less than the Adult threshold.</p>}
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {canEdit ? (
        <button className="btn btn-primary" disabled={!valid} onClick={save}>
          Save
        </button>
      ) : (
        <ViewOnlyNote />
      )}
    </div>
  );
}

function PassionWeekActivitiesCard({
  pwActivities,
  canEdit,
}: {
  pwActivities: PWActivityRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const sorted = [...pwActivities].sort((a, b) => a.sort_order - b.sort_order);
  const [drafts, setDrafts] = useState(
    Object.fromEntries(sorted.map((a) => [a.code, { label: a.label, sortOrder: a.sort_order }]))
  );

  async function saveDraft(code: (typeof sorted)[number]["code"]) {
    const draft = drafts[code];
    await updatePWActivityAction(code, { label: draft.label, sortOrder: draft.sortOrder });
    router.refresh();
  }

  async function toggleStatus(a: PWActivityRow) {
    await updatePWActivityAction(a.code, { status: a.status === "Active" ? "Inactive" : "Active" });
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Passion Week Activities</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Rename, reorder, or deactivate the 4 Passion Week readings. A deactivated one disappears from new
        Passion Week entry, but past assignments and reports stay untouched. The set itself is fixed.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Order</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.code}>
                <td>
                  <input
                    value={drafts[a.code].label}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [a.code]: { ...d[a.code], label: e.target.value } }))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70 }}
                    value={drafts[a.code].sortOrder}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [a.code]: { ...d[a.code], sortOrder: Number(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>
                  <span className={`badge ${a.status === "Active" ? "badge-green" : "badge-grey"}`}>{a.status}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => saveDraft(a.code)}>
                    Save
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => toggleStatus(a)}>
                    {a.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canEdit && <ViewOnlyNote />}
    </div>
  );
}

function QuickCheckinLocationsCard({ locations, canEdit }: { locations: LocationRow[]; canEdit: boolean }) {
  const router = useRouter();
  const active = locations.filter((l) => l.status === "Active");
  const [drafts, setDrafts] = useState(
    Object.fromEntries(
      active.map((l) => [
        l.id,
        {
          latitude: l.latitude != null ? String(l.latitude) : "",
          longitude: l.longitude != null ? String(l.longitude) : "",
          radius: l.geofence_radius_ft != null ? String(l.geofence_radius_ft) : "",
        },
      ])
    )
  );
  const [capturing, setCapturing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function capture(id: string) {
    if (!navigator.geolocation) {
      setError("This device doesn't support location detection.");
      return;
    }
    setCapturing(id);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDrafts((d) => ({
          ...d,
          [id]: {
            ...d[id],
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6),
          },
        }));
        setCapturing(null);
      },
      () => {
        setError("Couldn't get your current location — check that location access is allowed for this site.");
        setCapturing(null);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save(id: string) {
    const draft = drafts[id];
    setError(null);
    const result = await setLocationGeofenceAction(
      id,
      draft.latitude ? Number(draft.latitude) : null,
      draft.longitude ? Number(draft.longitude) : null,
      draft.radius ? Number(draft.radius) : null
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Quick Check-in Locations</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Pin each church&apos;s real-world coordinates so{" "}
        <Link href="/quick-checkin" target="_blank">
          Quick Check-in
        </Link>{" "}
        can confirm a deacon is physically there. Stand inside the church with your own phone and tap &quot;Use
        my current location,&quot; or enter coordinates manually. Radius is in feet — how far from the pin a
        phone can be and still check in.
      </p>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Radius (ft)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((l) => {
              const draft = drafts[l.id] ?? { latitude: "", longitude: "", radius: "" };
              return (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>
                    <input
                      style={{ width: 110 }}
                      value={draft.latitude}
                      disabled={!canEdit}
                      onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: { ...draft, latitude: e.target.value } }))}
                    />
                  </td>
                  <td>
                    <input
                      style={{ width: 110 }}
                      value={draft.longitude}
                      disabled={!canEdit}
                      onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: { ...draft, longitude: e.target.value } }))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      style={{ width: 70 }}
                      value={draft.radius}
                      disabled={!canEdit}
                      onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: { ...draft, radius: e.target.value } }))}
                    />
                  </td>
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!canEdit || capturing === l.id}
                      onClick={() => capture(l.id)}
                    >
                      {capturing === l.id ? "Locating…" : "Use my current location"}
                    </button>
                    <button className="btn btn-primary btn-sm" disabled={!canEdit} onClick={() => save(l.id)}>
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canEdit && <ViewOnlyNote />}
    </div>
  );
}

function LiturgyTimeCutoffsCard({
  locations,
  cutoffsByLocation,
  canEdit,
}: {
  locations: LocationRow[];
  cutoffsByLocation: Record<string, CutoffRow[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const active = locations.filter((l) => l.status === "Active");
  const [locationId, setLocationId] = useState(active[0]?.id ?? "");
  const rows = cutoffsByLocation[locationId] ?? [];
  const [drafts, setDrafts] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.weekday, r.cutoffTime]))
  );
  const [error, setError] = useState<string | null>(null);
  const [savingWeekday, setSavingWeekday] = useState<number | null>(null);

  function selectLocation(id: string) {
    setLocationId(id);
    const nextRows = cutoffsByLocation[id] ?? [];
    setDrafts(Object.fromEntries(nextRows.map((r) => [r.weekday, r.cutoffTime])));
    setError(null);
  }

  async function save(weekday: number) {
    setSavingWeekday(weekday);
    setError(null);
    const result = await setCutoffAction(locationId, weekday, drafts[weekday]);
    setSavingWeekday(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const rowLabels = [...WEEKDAY_NAMES, "Special Feast (any day)"];

  return (
    <div className="card">
      <h3>Liturgy Time Cutoffs</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        For each location, the time of day that separates the 1st Liturgy from the 2nd — used to predict which
        one is happening right now (e.g. for Quick Check-in). Special Feast has its own cutoff that applies
        instead, on whichever day a feast falls.
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
              <th>1st/2nd cutoff time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((label, weekday) => (
              <tr key={weekday}>
                <td>{label}</td>
                <td>
                  <input
                    type="time"
                    value={drafts[weekday] ?? "12:00"}
                    disabled={!canEdit}
                    onChange={(e) => setDrafts((d) => ({ ...d, [weekday]: e.target.value }))}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!canEdit || savingWeekday === weekday}
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
      {!canEdit && <ViewOnlyNote />}
    </div>
  );
}

export default function SettingsClient({
  locations,
  activities,
  settings,
  pwActivities,
  ranks,
  feastNames,
  dayFilterOptions,
  cutoffsByLocation,
  canEdit,
}: {
  locations: LocationRow[];
  activities: ActivityRow[];
  settings: AppSettings;
  pwActivities: PWActivityRow[];
  ranks: RankRow[];
  feastNames: FeastNameRow[];
  dayFilterOptions: DayFilterOptionRow[];
  cutoffsByLocation: Record<string, CutoffRow[]>;
  canEdit: boolean;
}) {
  return (
    <div>
      <h1>Settings</h1>
      <ServiceSuggestionsCard settings={settings} canEdit={canEdit} />
      <AgeGroupsCard settings={settings} canEdit={canEdit} />
      <RanksCard ranks={ranks} canEdit={canEdit} />
      <LocationsCard locations={locations} canEdit={canEdit} />
      <ActivitiesCard activities={activities} canEdit={canEdit} />
      <PassionWeekActivitiesCard pwActivities={pwActivities} canEdit={canEdit} />
      <DayFiltersCard dayFilterOptions={dayFilterOptions} canEdit={canEdit} />
      <FeastNamesCard feastNames={feastNames} canEdit={canEdit} />
      <QuickCheckinLocationsCard locations={locations} canEdit={canEdit} />
      <LiturgyTimeCutoffsCard locations={locations} cutoffsByLocation={cutoffsByLocation} canEdit={canEdit} />
    </div>
  );
}
