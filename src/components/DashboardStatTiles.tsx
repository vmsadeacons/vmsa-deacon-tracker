"use client";

import { useState } from "react";
import type { DeaconContact } from "@/lib/repo/dashboard";
import { formatPhone, telHref } from "@/lib/formatPhone";

function ContactList({ people }: { people: DeaconContact[] }) {
  if (people.length === 0) return <p className="muted">No one here.</p>;
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
  absencePeriodMonths,
}: {
  activeCount: number;
  activeDeacons: DeaconContact[];
  guestCount: number;
  absentCount: number;
  absentDeacons: DeaconContact[];
  absencePeriodMonths: number;
}) {
  const [open, setOpen] = useState<"active" | "absent" | null>(null);
  const activeLabel =
    guestCount > 0
      ? `Deacons (excluding ${guestCount} guest${guestCount === 1 ? "" : "s"})`
      : "Active deacons";

  return (
    <div>
      <div className="stat-row">
        <button className="stat-tile clickable" onClick={() => setOpen(open === "active" ? null : "active")}>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">{activeLabel}</div>
        </button>
        <button className="stat-tile clickable" onClick={() => setOpen(open === "absent" ? null : "absent")}>
          <div className="stat-value">{absentCount}</div>
          <div className="stat-label">Absent &gt; {absencePeriodMonths}mo</div>
        </button>
      </div>
      {open === "active" && (
        <div className="card">
          <h3>Active deacons</h3>
          <ContactList people={activeDeacons} />
        </div>
      )}
      {open === "absent" && (
        <div className="card">
          <h3>Absent more than {absencePeriodMonths} month{absencePeriodMonths === 1 ? "" : "s"}</h3>
          <ContactList people={absentDeacons} />
        </div>
      )}
    </div>
  );
}
