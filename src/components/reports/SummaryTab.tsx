"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import type { DayFilterOptionRow } from "@/lib/repo/dayFilterOptions";
import type { SummaryRow } from "@/lib/repo/reports";
import { getSummaryReportAction } from "@/app/(app)/reports/actions";
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
  const [period, setPeriod] = useState<Period>("ytd");
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
  const [fetching, setFetching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  // Guards against an older field-change's response landing after a newer
  // one -- e.g. a slow "Location" fetch resolving after a faster
  // subsequent "Rank" fetch.
  const fetchSeqRef = useRef(0);

  // Location/Service/Rank/Day/Period change which rows the server
  // aggregates, so they need a fresh fetch -- once on mount with the
  // defaults, then again on every change, with no "View" button needed.
  // Age group, Guests, and 0-attendance only re-slice rows already in the
  // browser (see `sorted` below), so they stay instant and never trigger
  // this. Every setState below runs inside a .then() callback, never
  // synchronously in the effect body itself.
  useEffect(() => {
    const seq = ++fetchSeqRef.current;

    const datePromise: Promise<{ from: string | null; to: string | null }> =
      period === "custom"
        ? (toDate ? Promise.resolve(toDate) : churchTodayAction()).then((to) => ({
            from: fromDate || null,
            to,
          }))
        : period === "ytd"
        ? Promise.all([yearStartAction(), churchTodayAction()]).then(([from, to]) => ({ from, to }))
        : Promise.all([monthsAgoAction(Number(period)), churchTodayAction()]).then(([from, to]) => ({
            from,
            to,
          }));

    datePromise
      .then(({ from, to }) => {
        if (seq !== fetchSeqRef.current) return null;
        setFetching(true);
        return getSummaryReportAction(
          from,
          to,
          locationId || null,
          (serviceType as ServiceTypeCode) || null,
          rankId || null,
          dayFilterId || null
        ).then((res) => ({ from, to, res }));
      })
      .then((result) => {
        if (!result || seq !== fetchSeqRef.current) return;
        const { from, to, res } = result;
        setRows(res.rows);
        setRangeLabel(dateRangeLabel(from ?? res.minDate, to));
        setFetching(false);
      });
  }, [period, fromDate, toDate, locationId, serviceType, rankId, dayFilterId]);

  // While a fetch is in flight, the whole page shows a wait cursor -- the
  // previous results stay on screen (see render below) rather than
  // disappearing, so switching a filter never flashes an empty table.
  useEffect(() => {
    document.body.style.cursor = fetching ? "wait" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [fetching]);

  const appliedFilters = useMemo(
    () => [
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
    ],
    [
      locations,
      locationId,
      serviceType,
      ranks,
      rankId,
      ageGroupFilter,
      dayFilterOptions,
      dayFilterId,
      includeGuests,
      includeZeroAttendance,
    ]
  );

  const sorted = useMemo(() => {
    if (!rows) return null;
    const filtered = rows.filter(
      (r) =>
        (!ageGroupFilter || r.ageGroup === ageGroupFilter) &&
        (includeZeroAttendance || r.attended > 0) &&
        (includeGuests || !r.isGuest)
    );
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
    });
    return copy;
  }, [rows, ageGroupFilter, includeZeroAttendance, includeGuests, sortKey, sortDir]);

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
    const meta = ["Summary Report", ...(rangeLabel ? [rangeLabel] : []), `Rows: ${sorted.length}`];
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
    // Leading BOM so Excel recognizes the file as UTF-8 -- without it, the
    // en dash/middle dot in the date range and filter lines render as
    // mojibake ("Ã¢â‚¬â€œ") since Excel otherwise assumes Windows-1252.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Always mirrors exactly what's on screen -- same rows, sort order, and filters as the CSV export. */
  function exportPdf() {
    if (!sorted) return;
    const doc = new jsPDF();
    const marginX = 14;
    let y = 18;

    doc.setFontSize(16);
    doc.text("Deacon Service Summary Report", marginX, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(90);
    if (rangeLabel) {
      doc.text(rangeLabel, marginX, y);
      y += 5;
    }
    const filtersText = appliedFilters.map((f) => `${f.label}: ${f.value}`).join("  ·  ");
    const filtersLines = doc.splitTextToSize(filtersText, 180);
    doc.text(filtersLines, marginX, y);
    y += filtersLines.length * 5;
    doc.text(`Rows: ${sorted.length}`, marginX, y);
    y += 5;
    doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, marginX, y);
    y += 4;
    doc.setTextColor(0);

    autoTable(doc, {
      startY: y + 4,
      margin: { left: marginX, right: marginX },
      head: [["Name", "Age group", "Attended", "Altar", "Readings"]],
      body: sorted.map((r) => [
        r.name + (r.isGuest ? " (Guest)" : ""),
        r.ageGroup ?? "—",
        String(r.attended),
        withPercent(r.altar, r.attended),
        withPercent(r.readings, r.attended),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [122, 46, 60] },
      alternateRowStyles: { fillColor: [246, 244, 239] },
    });

    doc.save("summary-report.pdf");
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
          <button className="btn btn-secondary" disabled={!sorted} onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn btn-secondary" disabled={!sorted} onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      {!sorted && fetching && <p className="muted">Loading…</p>}

      {sorted && (
        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginBottom: "0.35rem",
            }}
          >
            {rangeLabel && <p className="muted" style={{ margin: 0 }}>{rangeLabel}</p>}
            <p className="muted" style={{ margin: 0, fontWeight: 600 }}>
              {sorted.length} row{sorted.length === 1 ? "" : "s"}
            </p>
            {fetching && <span className="muted" style={{ fontSize: "0.8rem" }}>Updating…</span>}
          </div>
          <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}>
            {appliedFilters.map((f) => `${f.label}: ${f.value}`).join(" · ")}
          </p>
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
