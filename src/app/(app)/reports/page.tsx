import { Suspense } from "react";
import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listDeacons } from "@/lib/repo/deacons";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import { listRanks } from "@/lib/repo/ranks";
import { getUserById } from "@/lib/repo/users";
import { churchTodayISO, computeDefaultServiceType } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";
import ReportsClient from "@/components/ReportsClient";

export default async function ReportsPage() {
  const session = await requireAdmin();
  const [locations, deacons, pwActivities, ranks] = await Promise.all([
    listLocations(false),
    listDeacons(true),
    listPWActivities(),
    listRanks(false),
  ]);

  const date = churchTodayISO();
  // Read the sticky location straight from the DB rather than the session's
  // JWT -- the JWT is only populated at sign-in and never refreshed
  // mid-session, so it'd keep showing whatever was last used *before* this
  // login even after a location change writes a new value via setStickyLocation.
  const dbUser = await getUserById(session.user.id);
  const locationId =
    dbUser?.last_report_location_id ?? session.user.primaryLocationId ?? locations[0]?.id ?? "";
  const serviceType = computeDefaultServiceType(date) as ServiceTypeCode;
  const currentYear = Number(date.slice(0, 4));

  return (
    <Suspense>
      <ReportsClient
        locations={locations}
        deacons={deacons}
        defaultDate={date}
        defaultLocationId={locationId}
        defaultServiceType={serviceType}
        currentYear={currentYear}
        pwActivities={pwActivities}
        ranks={ranks}
      />
    </Suspense>
  );
}
