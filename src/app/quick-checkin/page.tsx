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

// Deliberately static (no `dynamic = "force-dynamic"`): this page fetches
// nothing on the server -- identity comes from the browser's own
// localStorage and location from its geolocation, and every server call
// happens later, from the client, via server actions. Prerendered once at
// build time it's served from Vercel's CDN, so opening the app costs no
// function invocation at all. If this page ever needs server-side data,
// it has to become dynamic again.
export default function QuickCheckinPage() {
  return <QuickCheckinClient />;
}
