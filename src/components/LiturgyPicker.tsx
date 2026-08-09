"use client";

import { useState } from "react";
import { SERVICE_TYPES, SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import type { LocationRow } from "@/lib/repo/locations";
import { computeDefaultServiceAction } from "@/lib/actions/shared";

export default function LiturgyPicker({
  date,
  locationId,
  serviceType,
  locations,
  onChange,
}: {
  date: string;
  locationId: string;
  serviceType: ServiceTypeCode;
  locations: LocationRow[];
  onChange: (date: string, locationId: string, serviceType: ServiceTypeCode) => void;
}) {
  const [recomputing, setRecomputing] = useState(false);

  async function handleDateChange(newDate: string) {
    setRecomputing(true);
    const nextService = await computeDefaultServiceAction(newDate);
    setRecomputing(false);
    onChange(newDate, locationId, nextService);
  }

  return (
    <div className="fieldrow">
      <div className="field">
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} />
      </div>
      <div className="field">
        <label>Location</label>
        <select value={locationId} onChange={(e) => onChange(date, e.target.value, serviceType)}>
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
