import type { DeaconHistory } from "@/lib/repo/reports";
import { pwServiceLabel, pwActivityLabel, type ServiceTypeCode } from "@/lib/constants";
import { withPercent } from "@/lib/percent";
import { formatLiturgyLabel } from "@/lib/liturgyLabel";

export default function HistoryTables({
  history,
  pwLabels,
  showParticipationPercent,
}: {
  history: DeaconHistory;
  pwLabels?: Record<string, string>;
  /** Altar/Readings tiles show "N (X%)" of liturgies attended -- opt-in so My History stays unchanged. */
  showParticipationPercent?: boolean;
}) {
  const attended = history.stats.liturgiesAttended;
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
        {history.records.length === 0 ? (
          <p className="muted">No records.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Participation</th>
                </tr>
              </thead>
              <tbody>
                {history.records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>
                      {formatLiturgyLabel({
                        date: r.date,
                        serviceType: r.serviceType as ServiceTypeCode,
                        isSpecialFeast: r.isSpecialFeast,
                        feastName: r.feastName,
                        hasSibling: r.hasSibling,
                      })}
                    </td>
                    <td>{r.locationName}</td>
                    <td>{r.activityName ?? "Attended"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Passion Week</h3>
        {history.passionWeek.length === 0 ? (
          <p className="muted">No Passion Week records.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Service</th>
                  <th>Hour</th>
                  <th>Reading</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {history.passionWeek.map((r, i) => (
                  <tr key={i}>
                    <td>{r.year}</td>
                    <td>{pwServiceLabel(r.serviceId)}</td>
                    <td>{r.hour}</td>
                    <td>{pwLabels?.[r.activityId] ?? pwActivityLabel(r.activityId)}</td>
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
