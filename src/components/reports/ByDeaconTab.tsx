"use client";

import { useMemo, useState } from "react";
import HistoryTables from "@/components/HistoryTables";
import SingleRosterPickerModal from "@/components/SingleRosterPickerModal";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { DeaconHistory } from "@/lib/repo/reports";
import type { LocationRow } from "@/lib/repo/locations";
import { getDeaconHistoryReportAction } from "@/app/(app)/reports/actions";
import { churchTodayAction, monthsAgoAction, yearStartAction } from "@/lib/actions/shared";
import { useLatestRequest } from "@/lib/useLatestRequest";
import { COMBINED_VM_SA_ID, COMBINED_VM_SA_LABEL } from "@/lib/locationGroups";
import { dateRangeLabel } from "@/lib/dateRange";

type Period = "3" | "6" | "12" | "ytd" | "custom";

export default function ByDeaconTab({
  deacons,
  locations,
  pwLabels,
}: {
  deacons: DeaconWithAgeGroup[];
  locations: LocationRow[];
  pwLabels: Record<string, string>;
}) {
  const [deaconId, setDeaconId] = useState("");
  const [period, setPeriod] = useState<Period>("3");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // Filters the deacon's records by where they actually happened (the
  // liturgy's real location), same as Summary's Location filter -- not by
  // the deacon's stated location preference, which is a different concept
  // entirely and was the wrong filter to use here.
  const [locationFilter, setLocationFilter] = useState(""); // "" = All locations
  const [includeGuests, setIncludeGuests] = useState(false);
  const [history, setHistory] = useState<DeaconHistory | null>(null);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const runLatest = useLatestRequest<DeaconHistory>();

  // The picker just offers every deacon (guest-filtered) -- Location is a
  // filter on the selected deacon's records, not on who's selectable.
  const pickableDeacons = useMemo(
    () => deacons.filter((d) => includeGuests || !d.is_guest),
    [deacons, includeGuests]
  );

  async function handleView() {
    if (!deaconId) return;
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
    runLatest(getDeaconHistoryReportAction(deaconId, from, to, locationFilter || null), (res) => {
      setHistory(res);
      // Records are sorted date desc, so the last one is the earliest --
      // resolves an open "From" to the deacon's actual earliest record.
      const earliestRecord = res.records[res.records.length - 1]?.date ?? null;
      setRangeLabel(dateRangeLabel(from ?? earliestRecord, to));
      setLoading(false);
    });
  }

  return (
    <div>
      <div className="card">
        <div className="fieldrow">
          <div className="field">
            <label>Deacon</label>
            <SingleRosterPickerModal
              items={pickableDeacons.map((d) => ({ id: d.id, name: d.name }))}
              selectedId={deaconId || null}
              onSelect={(id) => setDeaconId(id ?? "")}
              placeholder="— Select —"
              title="Choose a deacon"
              idPrefix="bydeacon"
            />
          </div>
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
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value={COMBINED_VM_SA_ID}>{COMBINED_VM_SA_LABEL}</option>
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
        </div>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={!deaconId} onClick={handleView}>
          View
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {history && !loading && (
        <>
          {rangeLabel && <p className="muted" style={{ margin: "0 0 0.75rem" }}>{rangeLabel}</p>}
          <HistoryTables history={history} pwLabels={pwLabels} showParticipationPercent sortable />
        </>
      )}
    </div>
  );
}
