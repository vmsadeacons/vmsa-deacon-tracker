import { requireAdmin } from "@/lib/authz";
import { getTodaySnapshot } from "@/lib/repo/liturgySchedule";
import CheckinControlClient from "@/components/CheckinControlClient";

export default async function CheckinPage() {
  await requireAdmin();
  const snapshot = await getTodaySnapshot();
  return <CheckinControlClient initial={snapshot} />;
}
