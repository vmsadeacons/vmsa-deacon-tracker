import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listActivities } from "@/lib/repo/activities";
import { listDeaconsLite } from "@/lib/repo/deacons";
import { listFeastNames } from "@/lib/repo/feastNames";
import { findLiturgyContext } from "@/lib/repo/liturgies";
import { setStickyLocation, getUserById } from "@/lib/repo/users";
import { getScheduleOptions } from "@/lib/repo/liturgySchedule";
import { churchTodayISO } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";
import RecordLiturgyClient from "@/components/RecordLiturgyClient";

export default async function RecordLiturgyPage() {
  const session = await requireAdmin();
  const [locations, activities, deacons, feastNames] = await Promise.all([
    listLocations(false),
    listActivities(false),
    listDeaconsLite(true),
    listFeastNames(true),
  ]);

  const date = churchTodayISO();
  // Read the sticky location straight from the DB rather than the session's
  // JWT -- the JWT is only populated at sign-in and never refreshed
  // mid-session, so it'd keep showing whatever was last used *before* this
  // login even after setStickyLocation writes a new value below.
  const dbUser = await getUserById(session.user.id);
  const locationId =
    dbUser?.last_record_location_id ?? session.user.primaryLocationId ?? locations[0]?.id ?? "";
  // Which liturgies are scheduled for this church today, and which one to
  // start on (the one in progress, or the first of the day).
  const schedule = locationId
    ? await getScheduleOptions(locationId, date)
    : { options: [], defaultService: "S1" as ServiceTypeCode };
  const serviceType = schedule.defaultService;

  let initialLiturgyId: string | null = null;
  let initialContext = null;
  if (locationId) {
    const result = await findLiturgyContext(date, locationId, serviceType);
    initialLiturgyId = result.liturgyId;
    initialContext = result.context;
    await setStickyLocation(session.user.id, "record", locationId);
  }

  return (
    <RecordLiturgyClient
      locations={locations}
      activities={activities}
      deacons={deacons}
      feastNames={feastNames}
      initialDate={date}
      initialLocationId={locationId}
      initialServiceType={serviceType}
      initialServiceOptions={schedule.options}
      initialLiturgyId={initialLiturgyId}
      initialContext={initialContext}
    />
  );
}
