"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceTypeCode } from "@/lib/constants";
import type { LocationRow } from "@/lib/repo/locations";
import type { ScheduleOption } from "@/lib/repo/liturgySchedule";
import { getScheduleOptionsAction, addExtraLiturgyAction } from "@/lib/actions/schedule";
import { weekdayLabel } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";

export default function LiturgyPicker({
  date,
  locationId,
  serviceType,
  locations,
  onChange,
  initialOptions,
  allowAddExtra,
}: {
  date: string;
  locationId: string;
  serviceType: ServiceTypeCode;
  locations: LocationRow[];
  onChange: (date: string, locationId: string, serviceType: ServiceTypeCode) => void;
  /** The scheduled liturgies for the starting date + church, when the page already has them; otherwise the picker fetches them on first render. */
  initialOptions?: ScheduleOption[];
  /** Shows "Add another liturgy" -- for Record a Liturgy, not for read-only report pickers. */
  allowAddExtra?: boolean;
}) {
  const [options, setOptions] = useState<ScheduleOption[] | null>(initialOptions ?? null);
  const [recomputing, setRecomputing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Guards against an older options fetch landing after a newer one.
  const seqRef = useRef(0);

  // Only when the page didn't hand over the starting options.
  useEffect(() => {
    if (initialOptions) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      const res = await getScheduleOptionsAction(locationId, date);
      if (!cancelled) setOptions(res.options);
    });
    return () => {
      cancelled = true;
    };
    // Starting values only -- later changes go through the handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Loads what's scheduled for a new date/church and moves the selection to its default, in one onChange (so the page never loads a liturgy that isn't on the schedule). */
  async function reload(newDate: string, newLocationId: string) {
    const seq = ++seqRef.current;
    setRecomputing(true);
    setAddError(null);
    const res = await getScheduleOptionsAction(newLocationId, newDate);
    if (seq !== seqRef.current) return;
    setOptions(res.options);
    setRecomputing(false);
    onChange(newDate, newLocationId, res.defaultService);
  }

  async function handleAddExtra() {
    setAdding(true);
    setAddError(null);
    const added = await addExtraLiturgyAction(locationId, date, null);
    if (!added.ok) {
      setAdding(false);
      setAddError(added.error);
      return;
    }
    const seq = ++seqRef.current;
    const res = await getScheduleOptionsAction(locationId, date);
    setAdding(false);
    if (seq !== seqRef.current) return;
    setOptions(res.options);
    onChange(date, locationId, added.serviceType);
  }

  // The selected liturgy always stays selectable, even if it isn't on the
  // schedule (e.g. an old liturgy opened from a link), so the box never goes blank.
  const shown: ScheduleOption[] = options ?? [];
  const list = shown.some((o) => o.serviceType === serviceType)
    ? shown
    : [...shown, { serviceType, label: SERVICE_LABELS[serviceType], startTime: "", isExtra: false }];

  return (
    <div className="fieldrow">
      <div className="field">
        <label>Date</label>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <input type="date" value={date} onChange={(e) => reload(e.target.value, locationId)} />
          {date && <span className="muted">{weekdayLabel(date)}</span>}
        </div>
      </div>
      <div className="field">
        <label>Location</label>
        <select value={locationId} onChange={(e) => reload(date, e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Service {recomputing && <span className="muted">(updating…)</span>}</label>
        <select value={serviceType} onChange={(e) => onChange(date, locationId, e.target.value as ServiceTypeCode)}>
          {list.map((o) => (
            <option key={o.serviceType} value={o.serviceType}>
              {o.label}
              {o.startTime ? ` · ${formatTime12(o.startTime)}` : ""}
              {o.isExtra ? " (extra)" : ""}
            </option>
          ))}
        </select>
        {allowAddExtra && shown.length < SERVICE_TYPES.length && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "0.5rem", alignSelf: "flex-start" }}
            disabled={adding || recomputing}
            onClick={handleAddExtra}
          >
            {adding ? "Adding…" : "+ Add another liturgy"}
          </button>
        )}
        {addError && <p className="error-text" style={{ marginTop: "0.4rem" }}>{addError}</p>}
      </div>
    </div>
  );
}
