"use client";

import { useRouter } from "next/navigation";
import type { RecentLiturgyRow } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";
import { formatLiturgyLabel } from "@/lib/liturgyLabel";

export default function RecentActivityTable({ rows }: { rows: RecentLiturgyRow[] }) {
  const router = useRouter();

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Location</th>
            <th>Date</th>
            <th>Service</th>
            <th>Attendees</th>
            <th>Altar service</th>
            <th>Readings filled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clickable = Boolean(row.date);
            return (
              <tr
                key={row.locationId}
                style={clickable ? { cursor: "pointer" } : undefined}
                onClick={
                  clickable
                    ? () => {
                        const params = new URLSearchParams({
                          tab: "by-liturgy",
                          date: row.date!,
                          locationId: row.locationId,
                          service: row.serviceType ?? "",
                        });
                        router.push(`/reports?${params.toString()}`);
                      }
                    : undefined
                }
              >
                <td>{row.locationName}</td>
                <td>{row.date ?? <span className="muted">No liturgies recorded yet</span>}</td>
                <td>
                  {row.serviceType && row.date
                    ? formatLiturgyLabel({
                        date: row.date,
                        serviceType: row.serviceType as ServiceTypeCode,
                        isSpecialFeast: row.isSpecialFeast,
                        feastName: row.feastName,
                        hasSibling: row.hasSibling,
                      })
                    : "—"}
                </td>
                <td>{clickable ? row.attendeeCount : "—"}</td>
                <td>{clickable ? row.altarCount : "—"}</td>
                <td>{clickable ? `${row.readingsFilled} of ${row.readingsTotal}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
