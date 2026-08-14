import { Suspense } from "react";
import { requireAdmin } from "@/lib/authz";
import { listDeacons } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import { listRanks } from "@/lib/repo/ranks";
import DeaconsClient from "@/components/DeaconsClient";

export default async function DeaconsPage() {
  await requireAdmin();
  const [deacons, locations, ranks] = await Promise.all([
    listDeacons(true),
    listLocations(true),
    listRanks(true),
  ]);

  return (
    <Suspense>
      <DeaconsClient deacons={deacons} locations={locations} ranks={ranks} />
    </Suspense>
  );
}
