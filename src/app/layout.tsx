import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VMSA Deacon Tracker",
  description: "Track deacon attendance and liturgical assignments",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
