import { Suspense } from "react";
import { requireAdmin } from "@/lib/authz";
import { listDeacons } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import DeaconsClient from "@/components/DeaconsClient";

export default async function DeaconsPage() {
  await requireAdmin();
  const [deacons, locations] = await Promise.all([listDeacons(true), listLocations(true)]);

  return (
    <Suspense>
      <DeaconsClient deacons={deacons} locations={locations} />
    </Suspense>
  );
}
