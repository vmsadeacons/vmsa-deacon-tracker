import { requireAdmin } from "@/lib/authz";
import { listUsers } from "@/lib/repo/users";
import { listDeacons } from "@/lib/repo/deacons";
import AccessRolesClient from "@/components/AccessRolesClient";

export default async function AccessPage() {
  const session = await requireAdmin();
  const [users, deacons] = await Promise.all([listUsers(), listDeacons(true)]);

  return <AccessRolesClient users={users} deacons={deacons} actorRole={session.user.role} />;
}
