import { requireAdmin } from "@/lib/authz";
import { listArchiveRuns } from "@/lib/repo/archive";
import ArchiveClient from "@/components/ArchiveClient";

export default async function ArchivePage() {
  await requireAdmin();
  const runs = await listArchiveRuns();
  return <ArchiveClient runs={runs} />;
}
