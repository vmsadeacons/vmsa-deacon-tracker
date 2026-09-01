"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProfileUpdateLogRow } from "@/lib/repo/publicProfile";

type SortKey = "deaconName" | "action" | "submittedAt";

export default function MemberUpdatesTable({ updates }: { updates: ProfileUpdateLogRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    const copy = [...updates];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return String(av).localeCompare(String(bv)) * sortDir;
    });
    return copy;
  }, [updates, sortKey, sortDir]);

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

  const columns: { key: SortKey; label: string }[] = [
    { key: "deaconName", label: "Name" },
    { key: "action", label: "Action" },
    { key: "submittedAt", label: "Submitted" },
  ];

  if (updates.length === 0) {
    return <p className="muted">No submissions yet.</p>;
  }

  return (
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
          {sorted.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/deacons?edit=${u.deaconId}`}>{u.deaconName}</Link>
              </td>
              <td>
                <span className={`badge ${u.action === "created" ? "badge-gold" : "badge-green"}`}>
                  {u.action === "created" ? "New" : "Updated"}
                </span>
              </td>
              <td>{new Date(u.submittedAt).toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
