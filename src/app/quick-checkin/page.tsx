import type { Metadata } from "next";
import QuickCheckinClient from "@/components/QuickCheckinClient";

// Public, no-login page -- keep it out of search engines.
export const metadata: Metadata = {
  title: "Quick Check-in",
  robots: { index: false, follow: false },
};

// No auth check here means nothing forces per-request rendering by
// default -- this page has no server-fetched data at all (identity comes
// from the browser's own localStorage, location comes from the browser's
// geolocation), but force-dynamic keeps it consistent with update-profile
// and safe against any future data this page might need.
export const dynamic = "force-dynamic";

export default function QuickCheckinPage() {
  return <QuickCheckinClient />;
}
