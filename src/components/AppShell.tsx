"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import CopticCross from "./CopticCross";
import type { Role } from "@/lib/constants";

export default function AppShell({
  role,
  name,
  appVersion,
  children,
}: {
  role: Role;
  name: string;
  appVersion: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <Sidebar role={role} name={name} appVersion={appVersion} open={open} onNavigate={() => setOpen(false)} />
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
