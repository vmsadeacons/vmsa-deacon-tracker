import { requireSession } from "@/lib/authz";
import { getDeacon } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import MyProfileClient from "@/components/MyProfileClient";

export default async function ProfilePage() {
  const session = await requireSession();
  if (!session.user.linkedDeaconId) {
    return (
      <div className="card">
        <p className="muted">Your account isn&apos;t linked to a deacon record yet — ask a System Admin to link you.</p>
      </div>
    );
  }
  const [deacon, locations] = await Promise.all([
    getDeacon(session.user.linkedDeaconId),
    listLocations(false),
  ]);
  if (!deacon) {
    return (
      <div className="card">
        <p className="muted">Your linked deacon record couldn&apos;t be found.</p>
      </div>
    );
  }
  return <MyProfileClient deacon={deacon} locations={locations} />;
}
