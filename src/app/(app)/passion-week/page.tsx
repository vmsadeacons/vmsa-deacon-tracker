import { requireAdmin } from "@/lib/authz";
import { listLocations } from "@/lib/repo/locations";
import { listDeacons } from "@/lib/repo/deacons";
import { listPWActivities } from "@/lib/repo/passionWeekActivities";
import { churchTodayISO } from "@/lib/timezone";
import PassionWeekClient from "@/components/PassionWeekClient";

export default async function PassionWeekPage() {
  await requireAdmin();
  const [locations, deacons, pwActivities] = await Promise.all([
    listLocations(false),
    listDeacons(true),
    listPWActivities(),
  ]);
  const initialYear = Number(churchTodayISO().slice(0, 4));

  return (
    <PassionWeekClient
      locations={locations}
      deacons={deacons}
      initialYear={initialYear}
      pwActivities={pwActivities}
    />
  );
}
