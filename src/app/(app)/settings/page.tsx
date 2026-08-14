import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listActivities } from "@/lib/repo/activities";
import { getAppSettings } from "@/lib/repo/settings";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import { listRanks } from "@/lib/repo/ranks";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [locations, activities, settings, pwActivities, ranks] = await Promise.all([
    listLocations(true),
    listActivities(true),
    getAppSettings(),
    listPWActivities(),
    listRanks(true),
  ]);

  return (
    <SettingsClient
      locations={locations}
      activities={activities}
      settings={settings}
      pwActivities={pwActivities}
      ranks={ranks}
      canEdit={session.user.role === "SystemAdmin"}
    />
  );
}
