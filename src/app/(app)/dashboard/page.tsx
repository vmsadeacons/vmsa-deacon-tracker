import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { getDashboardStats } from "@/lib/repo/dashboard";
import { getRecentLiturgiesByLocation } from "@/lib/repo/liturgies";
import { listLocations } from "@/lib/repo/locations";
import DashboardStatTiles from "@/components/DashboardStatTiles";
import RecentActivityTable from "@/components/RecentActivityTable";

export default async function DashboardPage() {
  await requireAdmin();
  const [stats, recent, locations] = await Promise.all([
    getDashboardStats(),
    getRecentLiturgiesByLocation(),
    listLocations(false),
  ]);

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="quick-actions">
        <Link href="/record" className="btn btn-primary">
          Record Liturgy
        </Link>
        <Link href="/deacons?add=1" className="btn btn-secondary">
          Add a deacon
        </Link>
        <Link href="/reports" className="btn btn-secondary">
          Reports
        </Link>
      </div>

      <DashboardStatTiles
        activeCount={stats.activeDeaconsCount}
        activeDeacons={stats.activeDeacons}
        guestCount={stats.guestCount}
        absentCount={stats.absentCount}
        absentDeacons={stats.absentDeacons}
        absencePeriodValue={stats.absencePeriodValue}
        absencePeriodUnit={stats.absencePeriodUnit}
        missingAgeGroupCount={stats.missingAgeGroupCount}
        missingPhoneCount={stats.missingPhoneCount}
        missingEmailCount={stats.missingEmailCount}
        locations={locations}
      />

      <div className="card">
        <h3>Recent activity by location</h3>
        <RecentActivityTable rows={recent} />
      </div>
    </div>
  );
}
