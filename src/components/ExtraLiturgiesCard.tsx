"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationRow } from "@/lib/repo/locations";
import type { ExtraRow } from "@/lib/repo/liturgySchedule";
import { SERVICE_LABELS } from "@/lib/constants";
import { WEEKDAY_NAMES, weekdayOfDateString } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";
import {
  addExtraLiturgyAction,
  planRecurringExtrasAction,
  addRecurringExtrasAction,
  removeExtraAction,
  removeExtraSeriesAction,
} from "@/lib/actions/schedule";

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const timeText = (r: Pick<ExtraRow, "startTime" | "startsEveningBefore">) =>
  `${formatTime12(r.startTime)}${r.startsEveningBefore ? " the evening before" : ""}`;

interface Group {
  key: string;
  rows: ExtraRow[];
}

type Preview = { willAdd: number; skippedHasExtra: number; skippedFull: number; skippedRecorded: number };

/** Adds extra liturgies on top of the regular schedule -- one day, or the same weekdays across a date range in one go. Every extra has its own start time. */
export default function ExtraLiturgiesCard({ locations, upcoming }: { locations: LocationRow[]; upcoming: ExtraRow[] }) {
  const router = useRouter();
  const active = locations.filter((l) => l.status === "Active");
  const [mode, setMode] = useState<"one" | "repeat">("one");
  const [churchIds, setChurchIds] = useState<string[]>(active[0] ? [active[0].id] : []);
  const [date, setDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startTime, setStartTime] = useState("");
  const [eveningBefore, setEveningBefore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, ExtraRow[]>();
    for (const r of upcoming) byKey.set(r.seriesId ?? r.id, [...(byKey.get(r.seriesId ?? r.id) ?? []), r]);
    return [...byKey.entries()].map(([key, rows]) => ({ key, rows })).sort((a, b) => a.rows[0].date.localeCompare(b.rows[0].date));
  }, [upcoming]);

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function resetFeedback() {
    setError(null);
    setMessage(null);
    setPreview(null);
  }

  const recurringInput = () => ({
    locationIds: churchIds,
    weekdays,
    from,
    to,
    startTime,
    startsEveningBefore: eveningBefore,
  });

  async function handlePreview() {
    resetFeedback();
    setBusy(true);
    const res = await planRecurringExtrasAction(recurringInput());
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setPreview({
        willAdd: res.willAdd,
        skippedHasExtra: res.skippedHasExtra,
        skippedFull: res.skippedFull,
        skippedRecorded: res.skippedRecorded,
      });
    }
  }

  async function handleAddRepeating() {
    setBusy(true);
    setError(null);
    const res = await addRecurringExtrasAction(recurringInput());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPreview(null);
    setMessage(`Added ${res.created} extra liturgies.`);
    router.refresh();
  }

  async function handleAddOneDay() {
    resetFeedback();
    if (churchIds.length === 0) return setError("Choose at least one church");
    if (!date) return setError("Choose a date");
    if (!startTime) return setError("Enter the time the liturgy starts");
    setBusy(true);
    let added = 0;
    const failures: string[] = [];
    for (const id of churchIds) {
      const res = await addExtraLiturgyAction(id, date, startTime, eveningBefore);
      if (res.ok) added++;
      else failures.push(`${active.find((l) => l.id === id)?.name ?? "Church"}: ${res.error}`);
    }
    setBusy(false);
    if (failures.length) setError(failures.join(" "));
    if (added) setMessage(`Added ${added} extra liturgy${added === 1 ? "" : "ies"} on ${fmtDate(date)}.`);
    router.refresh();
  }

  async function removeOne(id: string) {
    setError(null);
    setMessage(null);
    const res = await removeExtraAction(id);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function removeSeries(seriesId: string) {
    setError(null);
    setMessage(null);
    const res = await removeExtraSeriesAction(seriesId);
    if (!res.ok) setError(res.error);
    else {
      setMessage(
        `Removed ${res.removed} upcoming extra liturgies.` +
          (res.kept > 0 ? ` ${res.kept} could not be removed because attendance is recorded on or after them, and were kept.` : "")
      );
    }
    router.refresh();
  }

  const skippedText = (p: Preview) =>
    [
      p.skippedHasExtra > 0 ? `${p.skippedHasExtra} day(s) that already have an extra` : null,
      p.skippedFull > 0 ? `${p.skippedFull} day(s) that already have 3 liturgies` : null,
      p.skippedRecorded > 0 ? `${p.skippedRecorded} day(s) where it would renumber a liturgy that already has attendance` : null,
    ].filter(Boolean);

  return (
    <div className="card">
      <h3>Extra Liturgies</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Every church has 1 liturgy a day, and 2 on Sundays. Add an extra liturgy to one day (Sundays included, up to 3 in
        a day), or the same days of the week across a stretch of dates in one go. Every extra has its own start time. A
        midnight liturgy held the night before can be marked &ldquo;starts the evening before&rdquo; so it counts for the
        day after; it then becomes that day&apos;s 1st liturgy. You can also add one for today at the top of this page.
      </p>

      <div style={{ display: "flex", gap: "1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <input type="radio" name="extra-mode" checked={mode === "one"} onChange={() => { setMode("one"); resetFeedback(); }} />
          One day
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <input type="radio" name="extra-mode" checked={mode === "repeat"} onChange={() => { setMode("repeat"); resetFeedback(); }} />
          Repeating
        </label>
      </div>

      <div className="field" style={{ marginBottom: "1rem" }}>
        <label>Church{active.length > 1 ? "es" : ""}</label>
        <div style={{ display: "flex", gap: "0.4rem 1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={churchIds.length === active.length && active.length > 0}
              onChange={(e) => { setChurchIds(e.target.checked ? active.map((l) => l.id) : []); setPreview(null); }}
            />
            All
          </label>
          {active.map((l) => (
            <label key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={churchIds.includes(l.id)}
                onChange={() => { setChurchIds((c) => toggle(c, l.id)); setPreview(null); }}
              />
              {l.name}
            </label>
          ))}
        </div>
      </div>

      <div className="fieldrow" style={{ marginBottom: "1rem" }}>
        {mode === "one" ? (
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); resetFeedback(); }} />
          </div>
        ) : (
          <>
            <div className="field">
              <label>From</label>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} />
            </div>
            <div className="field">
              <label>To</label>
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} />
            </div>
          </>
        )}
        <div className="field">
          <label>Start time</label>
          <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setPreview(null); }} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
        <input
          type="checkbox"
          style={{ marginTop: "0.2rem" }}
          checked={eveningBefore}
          onChange={(e) => { setEveningBefore(e.target.checked); setPreview(null); }}
        />
        <span>Starts the evening before (a midnight liturgy that counts for the day after)</span>
      </label>

      {mode === "repeat" && (
        <div className="field" style={{ marginBottom: "1rem" }}>
          <label>On these days{eveningBefore ? " (the day each liturgy counts for)" : ""}</label>
          <div style={{ display: "flex", gap: "0.4rem 1rem", flexWrap: "wrap" }}>
            {WEEKDAY_NAMES.map((name, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(i)}
                  onChange={() => { setWeekdays((w) => toggle(w, i)); setPreview(null); }}
                />
                {name.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {message && <p style={{ marginBottom: "0.75rem", color: "var(--green)" }}>{message}</p>}

      {mode === "one" ? (
        <button className="btn btn-primary" disabled={busy} onClick={handleAddOneDay}>
          {busy ? "Adding…" : "Add extra liturgy"}
        </button>
      ) : preview ? (
        <div>
          <p style={{ marginBottom: "0.6rem" }}>
            This will add <strong>{preview.willAdd}</strong> extra liturgies
            {skippedText(preview).length > 0 && <>, skipping {skippedText(preview).join(", and ")}</>}.
          </p>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-primary" disabled={busy || preview.willAdd === 0} onClick={handleAddRepeating}>
              {busy ? "Adding…" : `Add ${preview.willAdd}`}
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={handlePreview}>
          {busy ? "Checking…" : "Preview"}
        </button>
      )}

      <h4 style={{ marginTop: "1.75rem", marginBottom: "0.5rem" }}>Upcoming extra liturgies</h4>
      {groups.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Church</th>
                <th>When</th>
                <th>Liturgy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const first = g.rows[0];
                const last = g.rows[g.rows.length - 1];
                const isSeries = g.rows.length > 1 && first.seriesId !== null;
                const days = [...new Set(g.rows.map((r) => weekdayOfDateString(r.date)))].sort();
                if (!isSeries) {
                  return g.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.locationName}</td>
                      <td>{fmtDate(r.date)} · {timeText(r)}</td>
                      <td>{SERVICE_LABELS[r.serviceType]}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" disabled={r.hasRecord} title={r.hasRecord ? "Already has attendance" : ""} onClick={() => removeOne(r.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ));
                }
                return (
                  <tr key={g.key}>
                    <td>{first.locationName}</td>
                    <td>
                      Repeating · {days.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(", ")}
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {fmtDate(first.date)} – {fmtDate(last.date)} · {g.rows.length} dates · {timeText(first)}
                      </div>
                      <details style={{ marginTop: "0.3rem" }}>
                        <summary className="muted" style={{ cursor: "pointer", fontSize: "0.8rem" }}>Show dates</summary>
                        <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }}>
                          {g.rows.map((r) => (
                            <li key={r.id} style={{ fontSize: "0.85rem" }}>
                              {fmtDate(r.date)} · {SERVICE_LABELS[r.serviceType]}{" "}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ marginLeft: "0.4rem" }}
                                disabled={r.hasRecord}
                                onClick={() => removeOne(r.id)}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                    <td>{SERVICE_LABELS[first.serviceType]}{g.rows.some((r) => r.serviceType !== first.serviceType) ? " (varies)" : ""}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => removeSeries(first.seriesId!)}>
                        Remove all
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
