import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listActivities } from "@/lib/repo/activities";
import { listDeacons } from "@/lib/repo/deacons";
import { getOrCreateLiturgy, getLiturgyContext } from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import { churchTodayISO, computeDefaultServiceType } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";
import RecordLiturgyClient from "@/components/RecordLiturgyClient";

export default async function RecordLiturgyPage() {
  const session = await requireAdmin();
  const [locations, activities, deacons] = await Promise.all([
    listLocations(false),
    listActivities(false),
    listDeacons(true),
  ]);

  const date = churchTodayISO();
  const locationId =
    session.user.lastRecordLocationId ?? session.user.primaryLocationId ?? locations[0]?.id ?? "";
  const serviceType = computeDefaultServiceType(date) as ServiceTypeCode;

  let initialLiturgyId: string | null = null;
  let initialContext = null;
  if (locationId) {
    initialLiturgyId = await getOrCreateLiturgy(date, locationId, serviceType);
    await setStickyLocation(session.user.id, "record", locationId);
    initialContext = await getLiturgyContext(initialLiturgyId);
  }

  return (
    <RecordLiturgyClient
      locations={locations}
      activities={activities}
      deacons={deacons}
      initialDate={date}
      initialLocationId={locationId}
      initialServiceType={serviceType}
      initialLiturgyId={initialLiturgyId}
      initialContext={initialContext}
    />
  );
}
