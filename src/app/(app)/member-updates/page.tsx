import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { listProfileUpdates } from "@/lib/repo/publicProfile";
import MemberUpdatesTable from "@/components/MemberUpdatesTable";

export default async function MemberUpdatesPage() {
  await requireAdmin();
  const updates = await listProfileUpdates();
  const createdCount = updates.filter((u) => u.action === "created").length;
  const updatedCount = updates.filter((u) => u.action === "updated").length;

  return (
    <div>
      <h1>Member Updates</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Submissions from the public{" "}
        <Link href="/update-profile" target="_blank">
          Update Your Profile
        </Link>{" "}
        form — {createdCount} new record{createdCount === 1 ? "" : "s"}, {updatedCount} update
        {updatedCount === 1 ? "" : "s"}.
      </p>

      <div className="card">
        <MemberUpdatesTable updates={updates} />
      </div>
    </div>
  );
}
