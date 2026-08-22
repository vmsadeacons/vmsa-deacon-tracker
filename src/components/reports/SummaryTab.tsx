"use client";

import { useMemo, useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import type { DayFilterOptionRow } from "@/lib/repo/dayFilterOptions";
import type { SummaryRow } from "@/lib/repo/reports";
import { getSummaryReportAction } from "@/app/(app)/reports/actions";
import { useLatestRequest } from "@/lib/useLatestRequest";
import { churchTodayAction, monthsAgoAction, yearStartAction } from "@/lib/actions/shared";
import { SERVICE_TYPES, SERVICE_LABELS, AGE_GROUPS, type ServiceTypeCode } from "@/lib/constants";
import { withPercent } from "@/lib/percent";
import { dateRangeLabel } from "@/lib/dateRange";

type Period = "3" | "6" | "12" | "ytd" | "custom";
type SortKey = "name" | "ageGroup" | "attended" | "altar" | "readings";

export default function SummaryTab({
  locations,
  ranks,
  dayFilterOptions,
}: {
  locations: LocationRow[];
  ranks: RankRow[];
  dayFilterOptions: DayFilterOptionRow[];
}) {
  const [period, setPeriod] = useState<Period>("3");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [locationId, setLocationId] = useState(""); // "" = All locations, per spec §6.5
  const [serviceType, setServiceType] = useState(""); // "" = All services
  const [rankId, setRankId] = useState(""); // "" = All ranks
  const [ageGroupFilter, setAgeGroupFilter] = useState(""); // "" = All age groups
  const [dayFilterId, setDayFilterId] = useState(""); // "" = All days
  const [includeGuests, setIncludeGuests] = useState(false);
  const [includeZeroAttendance, setIncludeZeroAttendance] = useState(false);
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const runLatest = useLatestRequest<{ rows: SummaryRow[]; minDate: string | null }>();

  // Snapshot of every filter as it stood when "View" was clicked -- shown
  // above the results and baked into the CSV export, so the criteria behind
  // a set of numbers is never ambiguous (spec ask: exports were hard to
  // interpret without seeing the filters that produced them).
  function currentFilterSummary(): { label: string; value: string }[] {
    return [
      { label: "Location", value: locations.find((l) => l.id === locationId)?.name ?? "All locations" },
      {
        label: "Service",
        value: serviceType ? SERVICE_LABELS[serviceType as ServiceTypeCode] : "All services",
      },
      { label: "Rank", value: ranks.find((r) => r.id === rankId)?.name ?? "All ranks" },
      { label: "Age group", value: ageGroupFilter || "All age groups" },
      { label: "Day", value: dayFilterOptions.find((o) => o.id === dayFilterId)?.label ?? "All days" },
      { label: "Guests", value: includeGuests ? "Included" : "Excluded" },
      { label: "0-attendance deacons", value: includeZeroAttendance ? "Included" : "Excluded" },
    ];
  }

  async function handleView() {
    let from: string | null;
    let to: string | null;
    if (period === "custom") {
      from = fromDate || null;
      to = toDate || (await churchTodayAction());
    } else if (period === "ytd") {
      from = await yearStartAction();
      to = await churchTodayAction();
    } else {
      from = await monthsAgoAction(Number(period));
      to = await churchTodayAction();
    }
    setLoading(true);
    runLatest(
      getSummaryReportAction(
        from,
        to,
        locationId || null,
        (serviceType as ServiceTypeCode) || null,
        includeGuests,
        rankId || null,
        dayFilterId || null
      ),
      (res) => {
        setRows(res.rows);
        setRangeLabel(dateRangeLabel(from ?? res.minDate, to));
        setAppliedFilters(currentFilterSummary());
        setLoading(false);
      }
    );
  }

  const sorted = useMemo(() => {
    if (!rows) return null;
    const filtered = rows.filter(
      (r) =>
        (!ageGroupFilter || r.ageGroup === ageGroupFilter) &&
        (includeZeroAttendance || r.attended > 0)
    );
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
    return copy;
  }, [rows, ageGroupFilter, includeZeroAttendance, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === 1 ? " ▲" : " ▼";
  }

  function exportCsv() {
    if (!sorted) return;
    const escapeCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const meta = ["Summary Report", ...(rangeLabel ? [rangeLabel] : [])];
    for (const f of appliedFilters) meta.push(`${f.label}: ${f.value}`);
    const header = ["Name", "Age group", "Attended", "Altar", "Readings"];
    const lines = [...meta.map(escapeCell), "", header.join(",")];
    for (const r of sorted) {
      lines.push(
        [r.name, r.ageGroup ?? "", r.attended, r.altar, r.readings]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "ageGroup", label: "Age group" },
    { key: "attended", label: "Attended" },
    { key: "altar", label: "Altar" },
    { key: "readings", label: "Readings" },
  ];

  return (
    <div>
      <div className="card">
        <div className="fieldrow">
          <div className="field">
            <label>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="ytd">Year to date</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          {period === "custom" && (
            <>
              <div className="field">
                <label>From</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="field">
                <label>To</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </>
          )}
          <div className="field">
            <label>Location</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Service</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
              <option value="">All services</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Rank</label>
            <select value={rankId} onChange={(e) => setRankId(e.target.value)}>
              <option value="">All ranks</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Age group</label>
            <select value={ageGroupFilter} onChange={(e) => setAgeGroupFilter(e.target.value)}>
              <option value="">All age groups</option>
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Day</label>
            <select value={dayFilterId} onChange={(e) => setDayFilterId(e.target.value)}>
              <option value="">All days</option>
              {dayFilterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={includeGuests}
                onChange={(e) => setIncludeGuests(e.target.checked)}
              />
              Include Guests
            </label>
          </div>
          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={includeZeroAttendance}
                onChange={(e) => setIncludeZeroAttendance(e.target.checked)}
              />
              Include 0 attendance
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={handleView}>
            View
          </button>
          <button className="btn btn-secondary" disabled={!sorted} onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {sorted && !loading && (
        <div className="card">
          {rangeLabel && <p className="muted" style={{ marginBottom: "0.35rem" }}>{rangeLabel}</p>}
          {appliedFilters.length > 0 && (
            <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}>
              {appliedFilters.map((f) => `${f.label}: ${f.value}`).join(" · ")}
            </p>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="sortable" onClick={() => toggleSort(col.key)}>
                      {col.label}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.deaconId}>
                    <td>
                      {r.name}
                      {r.isGuest && (
                        <span className="badge badge-gold" style={{ marginLeft: "0.4rem" }}>
                          Guest
                        </span>
                      )}
                    </td>
                    <td>{r.ageGroup ?? "—"}</td>
                    <td>{r.attended}</td>
                    <td>{withPercent(r.altar, r.attended)}</td>
                    <td>{withPercent(r.readings, r.attended)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
