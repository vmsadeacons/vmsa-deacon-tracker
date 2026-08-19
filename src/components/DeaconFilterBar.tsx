"use client";

import type { ReactNode } from "react";
import { LITURGY_PREF_TYPES, LITURGY_PREF_LABELS } from "@/lib/constants";
import type { LocationRow } from "@/lib/repo/locations";

export interface DeaconFilters {
  locationId: string;
  service: string;
  rank: string;
  ageGroup: string;
}

export const EMPTY_FILTERS: DeaconFilters = { locationId: "", service: "", rank: "", ageGroup: "" };

export default function DeaconFilterBar({
  filters,
  onChange,
  locations,
  ranks,
  ageGroups,
  extra,
}: {
  filters: DeaconFilters;
  onChange: (next: DeaconFilters) => void;
  locations: LocationRow[];
  ranks: string[];
  ageGroups: string[];
  /** Optional extra field(s) rendered before the rest of the row (e.g. the Dashboard's Absent period dropdown). */
  extra?: ReactNode;
}) {
  const hasActiveFilters = Boolean(
    filters.locationId || filters.service || filters.rank || filters.ageGroup
  );

  return (
    <div className="fieldrow" style={{ marginBottom: "1rem", alignItems: "end" }}>
      {extra}
      <div className="field">
        <label>Preferred location</label>
        <select
          value={filters.locationId}
          onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
        >
          <option value="">All</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Preferred service</label>
        <select value={filters.service} onChange={(e) => onChange({ ...filters, service: e.target.value })}>
          <option value="">All</option>
          {LITURGY_PREF_TYPES.map((s) => (
            <option key={s} value={s}>
              {LITURGY_PREF_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Rank</label>
        <select value={filters.rank} onChange={(e) => onChange({ ...filters, rank: e.target.value })}>
          <option value="">All</option>
          {ranks.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Age group</label>
        <select value={filters.ageGroup} onChange={(e) => onChange({ ...filters, ageGroup: e.target.value })}>
          <option value="">All</option>
          {ageGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!hasActiveFilters}
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
