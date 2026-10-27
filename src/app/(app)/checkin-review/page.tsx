import { requireAdmin } from "@/lib/authz";
import { listFlags } from "@/lib/repo/checkinReview";
import AccessNote, { ACCESS } from "@/components/AccessNote";
import CheckinReviewClient from "@/components/CheckinReviewClient";

export default async function CheckinReviewPage() {
  await requireAdmin();
  const { pending, reviewed } = await listFlags();

  return (
    <div>
      <h1>Check-in review</h1>
      <AccessNote>{ACCESS.adminsEdit}</AccessNote>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Check-ins we couldn&apos;t confirm were made at the church. They already count as attendance. Confirm to keep
        one, or reject to remove it (a record of the rejection is kept).
      </p>
      <CheckinReviewClient pending={pending} reviewed={reviewed} />
    </div>
  );
}
