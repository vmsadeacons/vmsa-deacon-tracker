import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VMSA Deacon Tracker",
  description: "Track deacon attendance and liturgical assignments",
  // icon.png / apple-icon.png (both in this folder) and manifest.ts are
  // picked up automatically by Next.js's file-convention metadata --
  // nothing to reference here. appleWebApp makes "Add to Home Screen" on
  // iOS launch full-screen (no browser chrome) instead of just bookmarking
  // the page.
  appleWebApp: {
    capable: true,
    title: "Deacon Tracker",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7a2e3c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
