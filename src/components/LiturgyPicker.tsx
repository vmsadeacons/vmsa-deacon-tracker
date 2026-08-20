"use client";

import { useState } from "react";
import { SERVICE_TYPES, SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import type { LocationRow } from "@/lib/repo/locations";
import { computeDefaultServiceAction } from "@/lib/actions/shared";
import { weekdayLabel } from "@/lib/timezone";

export default function LiturgyPicker({
  date,
  locationId,
  serviceType,
  locations,
  onChange,
  dateLocked,
}: {
  date: string;
  locationId: string;
  serviceType: ServiceTypeCode;
  locations: LocationRow[];
  onChange: (date: string, locationId: string, serviceType: ServiceTypeCode) => void;
  /** Check-in: deacons can only check in for today, so the date isn't editable. */
  dateLocked?: boolean;
}) {
  const [recomputing, setRecomputing] = useState(false);

  async function handleDateChange(newDate: string) {
    setRecomputing(true);
    const nextService = await computeDefaultServiceAction(newDate);
    setRecomputing(false);
    onChange(newDate, locationId, nextService);
  }

  // Resets to the default ordinal on a location switch too -- otherwise a
  // "2nd Liturgy" selection left over from a previous location silently
  // carries into the new one, which (now that any day/location can have a
  // 2nd liturgy) can create a stray wrong-ordinal record instead of editing
  // the liturgy that actually happened.
  async function handleLocationChange(newLocationId: string) {
    setRecomputing(true);
    const nextService = await computeDefaultServiceAction(date);
    setRecomputing(false);
    onChange(date, newLocationId, nextService);
  }

  return (
    <div className="fieldrow">
      <div className="field">
        <label>Date</label>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {dateLocked ? (
            <span>{date}</span>
          ) : (
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} />
          )}
          {date && <span className="muted">{weekdayLabel(date)}</span>}
        </div>
      </div>
      <div className="field">
        <label>Location</label>
        <select value={locationId} onChange={(e) => handleLocationChange(e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Service {recomputing && <span className="muted">(updating…)</span>}</label>
        <select
          value={serviceType}
          onChange={(e) => onChange(date, locationId, e.target.value as ServiceTypeCode)}
        >
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
