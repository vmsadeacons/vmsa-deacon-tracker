import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listActivities } from "@/lib/repo/activities";
import { getAppSettings } from "@/lib/repo/settings";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  await requireAdmin();
  const [locations, activities, settings] = await Promise.all([
    listLocations(true),
    listActivities(true),
    getAppSettings(),
  ]);

  return <SettingsClient locations={locations} activities={activities} settings={settings} />;
}
