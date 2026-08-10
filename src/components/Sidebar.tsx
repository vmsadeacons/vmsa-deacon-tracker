"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { NAV_GROUPS } from "@/lib/nav";
import type { Role } from "@/lib/constants";
import CopticCross from "./CopticCross";

export default function Sidebar({
  role,
  name,
  appVersion,
  open,
  onNavigate,
}: {
  role: Role;
  name: string;
  appVersion: string;
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = role === "SystemAdmin" || role === "GeneralAdmin";

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <CopticCross size={24} />
        VMSA Deacon Tracker
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        {NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group) => (
          <div key={group.label}>
            <div className="navsection-label">{group.label}</div>
            <div className="navgroup">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`navlink ${pathname?.startsWith(item.href) ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </span>
          <span className="muted">
            {role} · {appVersion}
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
