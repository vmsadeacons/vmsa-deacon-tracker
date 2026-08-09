import { requireSession } from "@/lib/authz";
import { getDeaconHistory } from "@/lib/repo/reports";
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
  const history = await getDeaconHistory(session.user.linkedDeaconId, null, null);
  return (
    <div>
      <h1>My History</h1>
      <HistoryTables history={history} />
    </div>
  );
}
