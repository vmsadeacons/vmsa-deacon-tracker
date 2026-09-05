import type { Metadata } from "next";
import QuickCheckinClient from "@/components/QuickCheckinClient";

// Public, no-login page -- keep it out of search engines.
//
// manifest: modern iOS Safari (16.4+) and Android/Chrome read the Web App
// Manifest -- not the page's own <title> -- for the name and launch URL
// used by "Add to Home Screen". Next.js only auto-generates one manifest
// for the whole site (src/app/manifest.ts, a root-only file convention --
// nesting one under quick-checkin/ is NOT picked up), so without this
// override /quick-checkin inherited that manifest's name ("VMSA Deacon
// Tracker") and start_url ("/"), meaning the home screen icon opened the
// main app instead of this page. This points at a small static manifest
// (public/quick-checkin-manifest.webmanifest) instead.
//
// appleWebApp.title covers older iOS versions that still read this meta
// tag rather than the manifest.
export const metadata: Metadata = {
  title: "Agios Checkin",
  robots: { index: false, follow: false },
  manifest: "/quick-checkin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Agios Checkin",
    statusBarStyle: "default",
  },
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
