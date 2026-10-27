"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPendingFlagCountAction } from "@/lib/actions/checkinReview";
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
  const [count, setCount] = useState(reviewCount);
  const pathname = usePathname();
  const isAdmin = role === "SystemAdmin" || role === "GeneralAdmin";

  // The layout only counts when the page is first loaded, so keep the number
  // fresh: re-read it every minute while the tab is showing, when the admin
  // comes back to the tab, and after each move to another page.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const n = await getPendingFlagCountAction();
        if (!cancelled) setCount(n);
      } catch {
        // Keep the last number; the next tick tries again.
      }
    }
    refresh();
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isAdmin, pathname]);

  // When the app is installed on a phone or computer, show the same number on
  // its icon. Not every browser has this; it simply does nothing there.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count > 0) nav.setAppBadge?.(count).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [count]);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <Sidebar role={role} name={name} appVersion={appVersion} reviewCount={count} open={open} onNavigate={() => setOpen(false)} />
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
