"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import CopticCross from "./CopticCross";
import type { Role } from "@/lib/constants";

export default function AppShell({
  role,
  name,
  appVersion,
  reviewCount,
  children,
}: {
  role: Role;
  name: string;
  appVersion: string;
  reviewCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // When the app is installed on a phone or computer, show the same number on
  // its icon. Not every browser has this; it simply does nothing there.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (reviewCount > 0) nav.setAppBadge?.(reviewCount).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [reviewCount]);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <Sidebar role={role} name={name} appVersion={appVersion} reviewCount={reviewCount} open={open} onNavigate={() => setOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="topbar">
          <button className="hamburger" aria-label="Open menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
          <span className="sidebar-brand" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CopticCross size={20} />
            VMSA Deacon Tracker
          </span>
        </div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
