"use client";

import { useState } from "react";
import type { LocationRow } from "@/lib/repo/locations";
import type { SummaryRow } from "@/lib/repo/reports";
import { getSummaryReportAction } from "@/app/(app)/reports/actions";

export default function SummaryTab({ locations }: { locations: LocationRow[] }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [locationId, setLocationId] = useState(""); // "" = All locations, per spec §6.5
  const [rows, setRows] = useState<SummaryRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleView() {
    setLoading(true);
    setRows(await getSummaryReportAction(fromDate || null, toDate || null, locationId || null));
    setLoading(false);
  }

  function exportCsv() {
    if (!rows) return;
    const header = ["Name", "Age group", "Attended", "Altar", "Readings"];
    const lines = [header.join(",")];
    for (const r of rows) {
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

  return (
    <div>
      <div className="card">
        <div className="fieldrow">
          <div className="field">
            <label>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
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
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={handleView}>
            View
          </button>
          <button className="btn btn-secondary" disabled={!rows} onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {rows && !loading && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age group</th>
                  <th>Attended</th>
                  <th>Altar</th>
                  <th>Readings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.deaconId}>
                    <td>{r.name}</td>
                    <td>{r.ageGroup ?? "—"}</td>
                    <td>{r.attended}</td>
                    <td>{r.altar}</td>
                    <td>{r.readings}</td>
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
