"use client";

import { useMemo, useState } from "react";
import type { DeaconContact, AbsencePeriodUnit } from "@/lib/repo/dashboard";
import type { LocationRow } from "@/lib/repo/locations";
import { ALL_SENTINEL } from "@/lib/constants";
import { getAbsentDeaconsAction } from "@/app/(app)/dashboard/actions";
import { useLatestRequest } from "@/lib/useLatestRequest";
import MessageableDeaconList from "./MessageableDeaconList";
import DeaconFilterBar, { EMPTY_FILTERS, type DeaconFilters } from "./DeaconFilterBar";

const PERIOD_OPTIONS: { value: number; unit: AbsencePeriodUnit; label: string }[] = [
  { value: 1, unit: "weeks", label: "1 week" },
  { value: 2, unit: "weeks", label: "2 weeks" },
  { value: 3, unit: "weeks", label: "3 weeks" },
  { value: 1, unit: "months", label: "1 month" },
  { value: 2, unit: "months", label: "2 months" },
  { value: 3, unit: "months", label: "3 months" },
  { value: 6, unit: "months", label: "6 months" },
];

function matchesPref(prefs: string[], value: string): boolean {
  return prefs.includes(ALL_SENTINEL) || prefs.includes(value);
}

function applyFilters(people: DeaconContact[], filters: DeaconFilters): DeaconContact[] {
  return people.filter((p) => {
    if (filters.locationId && !matchesPref(p.location_prefs, filters.locationId)) return false;
    if (filters.service && !matchesPref(p.liturgy_prefs, filters.service)) return false;
    if (filters.rank && p.rank !== filters.rank) return false;
    if (filters.ageGroup && p.age_group !== filters.ageGroup) return false;
    return true;
  });
}

export default function DashboardStatTiles({
  activeCount,
  activeDeacons,
  guestCount,
  absentCount,
  absentDeacons,
  absencePeriodValue,
  absencePeriodUnit,
  locations,
}: {
  activeCount: number;
  activeDeacons: DeaconContact[];
  guestCount: number;
  absentCount: number;
  absentDeacons: DeaconContact[];
  absencePeriodValue: number;
  absencePeriodUnit: AbsencePeriodUnit;
  locations: LocationRow[];
}) {
  const [open, setOpen] = useState<"active" | "absent" | null>(null);
  const [filters, setFilters] = useState<DeaconFilters>(EMPTY_FILTERS);
  const [period, setPeriod] = useState<{ value: number; unit: AbsencePeriodUnit }>({
    value: absencePeriodValue,
    unit: absencePeriodUnit,
  });
  const [absentData, setAbsentData] = useState<{ count: number; people: DeaconContact[] }>({
    count: absentCount,
    people: absentDeacons,
  });
  const [periodLoading, setPeriodLoading] = useState(false);
  const runLatestAbsent = useLatestRequest<{ absentCount: number; absentDeacons: DeaconContact[] }>();
  const activeLabel =
    guestCount > 0
      ? `Deacons (excluding ${guestCount} guest${guestCount === 1 ? "" : "s"})`
      : "Active deacons";
  const unitAbbrev = period.unit === "weeks" ? "wk" : "mo";
  const unitWord = period.unit === "weeks" ? "week" : "month";

  function handlePeriodChange(value: number, unit: AbsencePeriodUnit) {
    setPeriod({ value, unit });
    setPeriodLoading(true);
    runLatestAbsent(getAbsentDeaconsAction(value, unit), (res) => {
      setAbsentData({ count: res.absentCount, people: res.absentDeacons });
      setPeriodLoading(false);
    });
  }

  const currentList = useMemo(
    () => (open === "active" ? activeDeacons : open === "absent" ? absentData.people : []),
    [open, activeDeacons, absentData]
  );
  const filtered = useMemo(() => applyFilters(currentList, filters), [currentList, filters]);
  const rankOptions = useMemo(
    () => [...new Set(currentList.map((p) => p.rank).filter(Boolean))].sort(),
    [currentList]
  );
  const ageGroupOptions = useMemo(
    () => [...new Set(currentList.map((p) => p.age_group).filter((g): g is NonNullable<typeof g> => Boolean(g)))].sort(),
    [currentList]
  );

  function toggleOpen(next: "active" | "absent") {
    setOpen((cur) => (cur === next ? null : next));
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div>
      <div className="stat-row">
        <button className="stat-tile clickable" onClick={() => toggleOpen("active")}>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">{activeLabel}</div>
        </button>
        <button className="stat-tile clickable" onClick={() => toggleOpen("absent")}>
          <div className="stat-value">{absentData.count}</div>
          <div className="stat-label">
            Absent &gt; {period.value}{unitAbbrev}
          </div>
        </button>
      </div>
      {open === "active" && (
        <div className="card">
          <h3>Active deacons</h3>
          <DeaconFilterBar
            filters={filters}
            onChange={setFilters}
            locations={locations}
            ranks={rankOptions}
            ageGroups={ageGroupOptions}
          />
          <MessageableDeaconList people={filtered} />
        </div>
      )}
      {open === "absent" && (
        <div className="card">
          <h3>
            Absent more than {period.value} {unitWord}
            {period.value === 1 ? "" : "s"}
            {periodLoading && <span className="muted" style={{ fontWeight: 400, fontSize: "0.8rem", marginLeft: "0.5rem" }}>Updating…</span>}
          </h3>
          <DeaconFilterBar
            filters={filters}
            onChange={setFilters}
            locations={locations}
            ranks={rankOptions}
            ageGroups={ageGroupOptions}
            extra={
              <div className="field">
                <label>Absent for more than</label>
                <select
                  value={`${period.value}-${period.unit}`}
                  disabled={periodLoading}
                  onChange={(e) => {
                    const [v, u] = e.target.value.split("-");
                    handlePeriodChange(Number(v), u as AbsencePeriodUnit);
                  }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={`${opt.unit}-${opt.value}`} value={`${opt.value}-${opt.unit}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
          <MessageableDeaconList people={filtered} />
        </div>
      )}
    </div>
  );
}
