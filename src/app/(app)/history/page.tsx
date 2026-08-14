import { requireSession } from "@/lib/authz";
import { getDeaconHistory } from "@/lib/repo/reports";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import HistoryTables from "@/components/HistoryTables";

export default async function HistoryPage() {
  const session = await requireSession();
  if (!session.user.linkedDeaconId) {
    return (
      <div className="card">
        <p className="muted">Your account isn&apos;t linked to a deacon record yet — ask a System Admin to link you.</p>
      </div>
    );
  }
  const [history, pwActivities] = await Promise.all([
    getDeaconHistory(session.user.linkedDeaconId, null, null),
    listPWActivities(),
  ]);
  const pwLabels = Object.fromEntries(pwActivities.map((a) => [a.code, a.label]));

  return (
    <div>
      <h1>My History</h1>
      <div className="card">
        <p className="muted" style={{ marginBottom: 0 }}>
          Name: <strong>{session.user.name}</strong>
        </p>
      </div>
      <HistoryTables history={history} pwLabels={pwLabels} />
    </div>
  );
}
