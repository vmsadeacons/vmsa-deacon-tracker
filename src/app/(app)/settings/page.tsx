import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listActivities } from "@/lib/repo/activities";
import { getAppSettings } from "@/lib/repo/settings";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import { listRanks } from "@/lib/repo/ranks";
import { listFeastNames } from "@/lib/repo/feastNames";
import { listDayFilterOptions } from "@/lib/repo/dayFilterOptions";
import { listCutoffsForLocation, type CutoffRow } from "@/lib/repo/liturgyTimeCutoffs";
import { listDeacons } from "@/lib/repo/deacons";
import { listMergeLog } from "@/lib/repo/mergeDeacons";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [locations, activities, settings, pwActivities, ranks, feastNames, dayFilterOptions, deacons, mergeLog] =
    await Promise.all([
      listLocations(true),
      listActivities(true),
      getAppSettings(),
      listPWActivities(),
      listRanks(true),
      listFeastNames(true),
      listDayFilterOptions(),
      listDeacons(true),
      listMergeLog(),
    ]);

  const activeLocations = locations.filter((l) => l.status === "Active");
  const cutoffsByLocation: Record<string, CutoffRow[]> = {};
  await Promise.all(
    activeLocations.map(async (l) => {
      cutoffsByLocation[l.id] = await listCutoffsForLocation(l.id);
    })
  );

  return (
    <SettingsClient
      locations={locations}
      activities={activities}
      settings={settings}
      pwActivities={pwActivities}
      ranks={ranks}
      feastNames={feastNames}
      dayFilterOptions={dayFilterOptions}
      cutoffsByLocation={cutoffsByLocation}
      deacons={deacons}
      mergeLog={mergeLog}
      canEdit={session.user.role === "SystemAdmin"}
    />
  );
}
