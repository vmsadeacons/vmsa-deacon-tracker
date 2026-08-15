"use client";

import { useMemo, useState } from "react";
import type { DeaconContact } from "@/lib/repo/dashboard";
import type { AbsencePeriodUnit } from "@/lib/repo/settings";
import type { LocationRow } from "@/lib/repo/locations";
import { formatPhone, telHref } from "@/lib/formatPhone";
import { ALL_SENTINEL } from "@/lib/constants";
import AbsentDeaconsList from "./AbsentDeaconsList";
import DeaconFilterBar, { EMPTY_FILTERS, type DeaconFilters } from "./DeaconFilterBar";

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

function ContactList({ people }: { people: DeaconContact[] }) {
  if (people.length === 0) return <p className="muted">No one matches.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.phone ? <a href={telHref(p.phone)}>{formatPhone(p.phone)}</a> : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const activeLabel =
    guestCount > 0
      ? `Deacons (excluding ${guestCount} guest${guestCount === 1 ? "" : "s"})`
      : "Active deacons";
  const unitAbbrev = absencePeriodUnit === "weeks" ? "wk" : "mo";
  const unitWord = absencePeriodUnit === "weeks" ? "week" : "month";

  const currentList = useMemo(
    () => (open === "active" ? activeDeacons : open === "absent" ? absentDeacons : []),
    [open, activeDeacons, absentDeacons]
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
          <div className="stat-value">{absentCount}</div>
          <div className="stat-label">
            Absent &gt; {absencePeriodValue}{unitAbbrev}
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
          <ContactList people={filtered} />
        </div>
      )}
      {open === "absent" && (
        <div className="card">
          <h3>
            Absent more than {absencePeriodValue} {unitWord}
            {absencePeriodValue === 1 ? "" : "s"}
          </h3>
          <DeaconFilterBar
            filters={filters}
            onChange={setFilters}
            locations={locations}
            ranks={rankOptions}
            ageGroups={ageGroupOptions}
          />
          <AbsentDeaconsList people={filtered} />
        </div>
      )}
    </div>
  );
}
