import type { Metadata } from "next";
import QrCheckinClient from "@/components/QrCheckinClient";

// What a church's QR code opens (/qr?c=<that church's secret code>). Public,
// no login, kept out of search engines.
//
// Deliberately static, like /quick-checkin: the code is read from the address
// in the browser, so opening the page costs no function invocation -- the
// server is only called when the deacon actually checks in. If this page ever
// needs server-side data it has to become dynamic again.
export const metadata: Metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

export default function QrCheckinPage() {
  return <QrCheckinClient />;
}
