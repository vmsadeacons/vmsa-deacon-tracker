"use client";

import { useMemo, useState } from "react";
import type { DeaconHistory } from "@/lib/repo/reports";
import {
  pwServiceLabel,
  pwActivityLabel,
  PW_SERVICES,
  PW_HOUR_WITH_12TH,
  type ServiceTypeCode,
} from "@/lib/constants";
import { withPercent } from "@/lib/percent";
import { formatLiturgyLabel } from "@/lib/liturgyLabel";

type RecordSortKey = "date" | "service" | "location" | "participation";
type PwSortKey = "year" | "service" | "hour" | "reading" | "location";

function compareStrings(a: string, b: string, dir: 1 | -1) {
  return a.localeCompare(b) * dir;
}

export default function HistoryTables({
  history,
  pwLabels,
  showParticipationPercent,
  sortable,
}: {
  history: DeaconHistory;
  pwLabels?: Record<string, string>;
  /** Altar/Readings tiles show "N (X%)" of liturgies attended -- opt-in so My History stays unchanged. */
  showParticipationPercent?: boolean;
  /** Clickable, sortable column headers -- opt-in so My History stays unchanged. */
  sortable?: boolean;
}) {
  const attended = history.stats.liturgiesAttended;

  const [recordSort, setRecordSort] = useState<{ key: RecordSortKey; dir: 1 | -1 }>({
    key: "date",
    dir: -1,
  });
  const [pwSort, setPwSort] = useState<{ key: PwSortKey; dir: 1 | -1 }>({ key: "year", dir: -1 });

  function toggleRecordSort(key: RecordSortKey) {
    setRecordSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }
  function recordSortIndicator(key: RecordSortKey) {
    if (key !== recordSort.key) return "";
    return recordSort.dir === 1 ? " ▲" : " ▼";
  }

  function togglePwSort(key: PwSortKey) {
    setPwSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }
  function pwSortIndicator(key: PwSortKey) {
    if (key !== pwSort.key) return "";
    return pwSort.dir === 1 ? " ▲" : " ▼";
  }

  const recordRows = useMemo(() => {
    const rows = history.records.map((r) => ({
      ...r,
      serviceLabel: formatLiturgyLabel({
        date: r.date,
        serviceType: r.serviceType as ServiceTypeCode,
        isSpecialFeast: r.isSpecialFeast,
        feastName: r.feastName,
        hasSibling: r.hasSibling,
      }),
      participationLabel: r.activityName ?? "Attended",
    }));
    if (!sortable) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (recordSort.key) {
        case "date":
          return compareStrings(a.date, b.date, recordSort.dir);
        case "service":
          return compareStrings(a.serviceLabel, b.serviceLabel, recordSort.dir);
        case "location":
          return compareStrings(a.locationName, b.locationName, recordSort.dir);
        case "participation":
          return compareStrings(a.participationLabel, b.participationLabel, recordSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [history.records, sortable, recordSort]);

  const pwRows = useMemo(() => {
    const rows = history.passionWeek.map((r) => ({
      ...r,
      serviceLabel: pwServiceLabel(r.serviceId),
      serviceIndex: PW_SERVICES.findIndex((s) => s.id === r.serviceId),
      hourIndex: PW_HOUR_WITH_12TH.indexOf(r.hour as never),
      readingLabel: pwLabels?.[r.activityId] ?? pwActivityLabel(r.activityId),
    }));
    if (!sortable) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (pwSort.key) {
        case "year":
          return (a.year - b.year) * pwSort.dir;
        case "service":
          return (a.serviceIndex - b.serviceIndex) * pwSort.dir;
        case "hour":
          return (a.hourIndex - b.hourIndex) * pwSort.dir;
        case "reading":
          return compareStrings(a.readingLabel, b.readingLabel, pwSort.dir);
        case "location":
          return compareStrings(a.locationName, b.locationName, pwSort.dir);
        default:
          return 0;
      }
    });
    return copy;
  }, [history.passionWeek, pwLabels, sortable, pwSort]);

  const recordColumns: { key: RecordSortKey; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "service", label: "Service" },
    { key: "location", label: "Location" },
    { key: "participation", label: "Participation" },
  ];
  const pwColumns: { key: PwSortKey; label: string }[] = [
    { key: "year", label: "Year" },
    { key: "service", label: "Service" },
    { key: "hour", label: "Hour" },
    { key: "reading", label: "Reading" },
    { key: "location", label: "Location" },
  ];

  return (
    <div>
      <div className="stat-row stat-row-4">
        <div className="stat-tile">
          <div className="stat-value">{attended}</div>
          <div className="stat-label">Liturgies attended</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">
            {showParticipationPercent
              ? withPercent(history.stats.altarServices, attended)
              : history.stats.altarServices}
          </div>
          <div className="stat-label">Altar services</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">
            {showParticipationPercent
              ? withPercent(history.stats.readings, attended)
              : history.stats.readings}
          </div>
          <div className="stat-label">Readings</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{history.stats.passionWeekReadings}</div>
          <div className="stat-label">Passion Week readings</div>
        </div>
      </div>

      <div className="card">
        <h3>Records</h3>
        {recordRows.length === 0 ? (
          <p className="muted">No records.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {recordColumns.map((col) =>
                    sortable ? (
                      <th key={col.key} className="sortable" onClick={() => toggleRecordSort(col.key)}>
                        {col.label}
                        {recordSortIndicator(col.key)}
                      </th>
                    ) : (
                      <th key={col.key}>{col.label}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recordRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.serviceLabel}</td>
                    <td>{r.locationName}</td>
                    <td>{r.participationLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Passion Week</h3>
        {pwRows.length === 0 ? (
          <p className="muted">No Passion Week records.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {pwColumns.map((col) =>
                    sortable ? (
                      <th key={col.key} className="sortable" onClick={() => togglePwSort(col.key)}>
                        {col.label}
                        {pwSortIndicator(col.key)}
                      </th>
                    ) : (
                      <th key={col.key}>{col.label}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {pwRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.year}</td>
                    <td>{r.serviceLabel}</td>
                    <td>{r.hour}</td>
                    <td>{r.readingLabel}</td>
                    <td>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
