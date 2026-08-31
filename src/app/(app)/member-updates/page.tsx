import Link from "next/link";
import { requireAdmin } from "@/lib/authz";
import { listProfileUpdates } from "@/lib/repo/publicProfile";

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
        {updates.length === 0 ? (
          <p className="muted">No submissions yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Action</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/deacons?edit=${u.deaconId}`}>{u.deaconName}</Link>
                    </td>
                    <td>
                      <span className={`badge ${u.action === "created" ? "badge-gold" : "badge-green"}`}>
                        {u.action === "created" ? "New" : "Updated"}
                      </span>
                    </td>
                    <td>{new Date(u.submittedAt).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
