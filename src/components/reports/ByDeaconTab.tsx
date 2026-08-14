"use client";

import { useMemo, useState } from "react";
import HistoryTables from "@/components/HistoryTables";
import SingleRosterPickerModal from "@/components/SingleRosterPickerModal";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { DeaconHistory } from "@/lib/repo/reports";
import { getDeaconHistoryReportAction } from "@/app/(app)/reports/actions";
import { churchTodayAction, monthsAgoAction } from "@/lib/actions/shared";
import { useLatestRequest } from "@/lib/useLatestRequest";

type Period = "3" | "6" | "12" | "custom";

export default function ByDeaconTab({
  deacons,
  pwLabels,
}: {
  deacons: DeaconWithAgeGroup[];
  pwLabels: Record<string, string>;
}) {
  const [deaconId, setDeaconId] = useState("");
  const [period, setPeriod] = useState<Period>("3");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeGuests, setIncludeGuests] = useState(false);
  const [history, setHistory] = useState<DeaconHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const runLatest = useLatestRequest<DeaconHistory>();

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
      to = toDate || null;
    } else {
      from = await monthsAgoAction(Number(period));
      to = await churchTodayAction();
    }
    setLoading(true);
    runLatest(getDeaconHistoryReportAction(deaconId, from, to), (res) => {
      setHistory(res);
      setLoading(false);
    });
  }

  return (
    <div>
      <div className="card">
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={includeGuests}
            onChange={(e) => setIncludeGuests(e.target.checked)}
          />
          Include Guests
        </label>
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
        </div>
        <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={!deaconId} onClick={handleView}>
          View
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {history && !loading && <HistoryTables history={history} pwLabels={pwLabels} />}
    </div>
  );
}
