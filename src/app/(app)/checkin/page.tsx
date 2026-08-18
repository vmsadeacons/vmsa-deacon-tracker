import { requireSession } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { findLiturgyContext } from "@/lib/repo/liturgies";
import { setStickyLocation } from "@/lib/repo/users";
import { churchTodayISO, computeDefaultServiceType } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";
import CheckinClient from "@/components/CheckinClient";

export default async function CheckinPage() {
  const session = await requireSession();
  const locations = await listLocations(false);

  const date = churchTodayISO();
  const locationId =
    session.user.lastCheckinLocationId ?? session.user.primaryLocationId ?? locations[0]?.id ?? "";
  const serviceType = computeDefaultServiceType(date) as ServiceTypeCode;

  let initialLiturgyId: string | null = null;
  let initialContext = null;
  if (locationId) {
    const result = await findLiturgyContext(date, locationId, serviceType);
    initialLiturgyId = result.liturgyId;
    initialContext = result.context;
    await setStickyLocation(session.user.id, "checkin", locationId);
  }

  return (
    <CheckinClient
      locations={locations}
      linkedDeaconId={session.user.linkedDeaconId}
      myName={session.user.name ?? ""}
      initialDate={date}
      initialLocationId={locationId}
      initialServiceType={serviceType}
      initialLiturgyId={initialLiturgyId}
      initialContext={initialContext}
    />
  );
}
