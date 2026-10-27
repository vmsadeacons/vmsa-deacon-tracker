import { requireAdmin } from "@/lib/authz";
import {
  getTodaySnapshot,
  getCheckinWindowSettings,
  listStartTimes,
  listUpcomingExtras,
  type StartTimeCell,
} from "@/lib/repo/liturgySchedule";
import { listLocations } from "@/lib/repo/locations";
import CheckinControlClient from "@/components/CheckinControlClient";
import CheckinWindowSettingsCard from "@/components/CheckinWindowSettingsCard";
import LiturgyStartTimesCard from "@/components/LiturgyStartTimesCard";
import ExtraLiturgiesCard from "@/components/ExtraLiturgiesCard";

export default async function CheckinWindowsPage() {
  await requireAdmin();
  const [snapshot, windows, locations, upcomingExtras] = await Promise.all([
    getTodaySnapshot(),
    getCheckinWindowSettings(),
    listLocations(true),
    listUpcomingExtras(),
  ]);

  const startTimesByLocation: Record<string, StartTimeCell[]> = {};
  await Promise.all(
    locations
      .filter((l) => l.status === "Active")
      .map(async (l) => {
        startTimesByLocation[l.id] = await listStartTimes(l.id);
      })
  );

  return (
    <div>
      <CheckinControlClient initial={snapshot} />
      <CheckinWindowSettingsCard settings={windows} />
      <LiturgyStartTimesCard
        locations={locations}
        startTimesByLocation={startTimesByLocation}
        openBefore={windows.openBefore}
      />
      <ExtraLiturgiesCard locations={locations} upcoming={upcomingExtras} />
    </div>
  );
}
