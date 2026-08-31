import type { Metadata } from "next";
import UpdateProfileClient from "@/components/UpdateProfileClient";
import { getPublicFormOptionsAction } from "./actions";

// Public, no-login page -- keep it out of search engines.
export const metadata: Metadata = {
  title: "Update Your Profile",
  robots: { index: false, follow: false },
};

// No auth check here means nothing forces per-request rendering by default
// -- without this, Next.js would prerender the page once at build time and
// keep serving that same snapshot of locations/ranks/age-group thresholds
// until the next deploy, even after an admin changes them in Settings.
export const dynamic = "force-dynamic";

export default async function UpdateProfilePage() {
  const { locations, ranks, ageGroupThresholds } = await getPublicFormOptionsAction();
  return <UpdateProfileClient locations={locations} ranks={ranks} ageGroupThresholds={ageGroupThresholds} />;
}
