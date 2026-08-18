import { Suspense } from "react";
import { requireAdmin } from "@/lib/authz";
import { listDeacons } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import { listRanks } from "@/lib/repo/ranks";
import { getAppSettings } from "@/lib/repo/settings";
import DeaconsClient from "@/components/DeaconsClient";

export default async function DeaconsPage() {
  await requireAdmin();
  const [deacons, locations, ranks, settings] = await Promise.all([
    listDeacons(true),
    listLocations(true),
    listRanks(true),
    getAppSettings(),
  ]);

  return (
    <Suspense>
      <DeaconsClient
        deacons={deacons}
        locations={locations}
        ranks={ranks}
        ageGroupThresholds={{ youthMin: settings.ageGroupYouthMin, adultMin: settings.ageGroupAdultMin }}
      />
    </Suspense>
  );
}
