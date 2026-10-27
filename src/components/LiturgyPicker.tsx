"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceTypeCode } from "@/lib/constants";
import type { LocationRow } from "@/lib/repo/locations";
import type { ScheduleOption } from "@/lib/repo/liturgySchedule";
import { getScheduleOptionsAction } from "@/lib/actions/schedule";
import { weekdayLabel } from "@/lib/timezone";
import { liturgyOptionText } from "@/lib/liturgyOptionLabel";
import AddExtraInline from "./AddExtraInline";

export default function LiturgyPicker({
  date,
  locationId,
  serviceType,
  locations,
  onChange,
  initialOptions,
  onOptions,
  allowAddExtra,
}: {
  date: string;
  locationId: string;
  serviceType: ServiceTypeCode;
  locations: LocationRow[];
  onChange: (date: string, locationId: string, serviceType: ServiceTypeCode) => void;
  /** The scheduled liturgies for the starting date + church, when the page already has them; otherwise the picker fetches them on first render. */
  initialOptions?: ScheduleOption[];
  /** Told whenever the list of scheduled liturgies changes (a new date/church, or an extra was added). */
  onOptions?: (options: ScheduleOption[]) => void;
  /** Shows "Add another liturgy" -- for Record a Liturgy, not for read-only report pickers. */
  allowAddExtra?: boolean;
}) {
  const [options, setOptionsState] = useState<ScheduleOption[] | null>(initialOptions ?? null);
  const [recomputing, setRecomputing] = useState(false);
  // Guards against an older options fetch landing after a newer one.
  const seqRef = useRef(0);

  function setOptions(next: ScheduleOption[]) {
    setOptionsState(next);
    onOptions?.(next);
  }

  // Only when the page didn't hand over the starting options.
  useEffect(() => {
    if (initialOptions) return;
    let cancelled = false;
    Promise.resolve().then(async () => {
      const res = await getScheduleOptionsAction(locationId, date);
      if (cancelled) return;
      setOptionsState(res.options);
      onOptions?.(res.options);
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
    const res = await getScheduleOptionsAction(newLocationId, newDate);
    if (seq !== seqRef.current) return;
    setOptions(res.options);
    setRecomputing(false);
    onChange(newDate, newLocationId, res.defaultService);
  }

  async function handleExtraAdded(newService: ServiceTypeCode) {
    const seq = ++seqRef.current;
    const res = await getScheduleOptionsAction(locationId, date);
    if (seq !== seqRef.current) return;
    setOptions(res.options);
    onChange(date, locationId, newService);
  }

  // The selected liturgy always stays selectable, even if it isn't on the
  // schedule (e.g. an old liturgy opened from a link), so the box never goes blank.
  const shown: ScheduleOption[] = options ?? [];
  const list: ScheduleOption[] = shown.some((o) => o.serviceType === serviceType)
    ? shown
    : [
        ...shown,
        {
          serviceType,
          label: SERVICE_LABELS[serviceType],
          startTime: null,
          startsEveningBefore: false,
          isExtra: false,
          prefCodes: [],
        },
      ];

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
              {liturgyOptionText(o)}
            </option>
          ))}
        </select>
        {allowAddExtra && shown.length < SERVICE_TYPES.length && (
          <div style={{ marginTop: "0.5rem" }}>
            <AddExtraInline locationId={locationId} date={date} disabled={recomputing} onAdded={handleExtraAdded} />
          </div>
        )}
      </div>
    </div>
  );
}
