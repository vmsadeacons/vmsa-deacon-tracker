import { Suspense } from "react";
import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listDeacons } from "@/lib/repo/deacons";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import { churchTodayISO, computeDefaultServiceType } from "@/lib/timezone";
import type { ServiceTypeCode } from "@/lib/constants";
import ReportsClient from "@/components/ReportsClient";

export default async function ReportsPage() {
  const session = await requireAdmin();
  const [locations, deacons, pwActivities] = await Promise.all([
    listLocations(false),
    listDeacons(true),
    listPWActivities(),
  ]);

  const date = churchTodayISO();
  const locationId =
    session.user.lastReportLocationId ?? session.user.primaryLocationId ?? locations[0]?.id ?? "";
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
      />
    </Suspense>
  );
}
