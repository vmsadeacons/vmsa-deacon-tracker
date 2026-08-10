import { requireAdmin } from "@/lib/authz";
import { listArchiveRuns } from "@/lib/repo/archive";
import ArchiveClient from "@/components/ArchiveClient";

export default async function ArchivePage() {
  const session = await requireAdmin();
  const runs = await listArchiveRuns();
  return <ArchiveClient runs={runs} canEdit={session.user.role === "SystemAdmin"} />;
}
