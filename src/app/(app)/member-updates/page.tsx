import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { listProfileUpdates, listOverrideRequests } from "@/lib/repo/publicProfile";
import MemberUpdatesTable from "@/components/MemberUpdatesTable";
import OverrideRequestsTable from "@/components/OverrideRequestsTable";

export default async function MemberUpdatesPage() {
  await requireAdmin();
  const [updates, overrides] = await Promise.all([listProfileUpdates(), listOverrideRequests()]);
  const createdCount = updates.filter((u) => u.action === "created").length;
  const updatedCount = updates.filter((u) => u.action === "updated").length;
  const pendingCount = overrides.filter((o) => o.status === "pending").length;

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

      {pendingCount > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Override requests{" "}
            <span className="badge badge-gold" style={{ marginLeft: "0.4rem" }}>
              {pendingCount} pending
            </span>
          </h3>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Someone submitted a value that conflicts with what&apos;s already on file for these fields. Nothing
            has been changed yet — approve to apply the requested value, or reject to leave the record as-is.
          </p>
          <OverrideRequestsTable requests={overrides} />
        </div>
      )}
      {pendingCount === 0 && overrides.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Override requests</h3>
          <OverrideRequestsTable requests={overrides} />
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>All submissions</h3>
        <MemberUpdatesTable updates={updates} />
      </div>
    </div>
  );
}
