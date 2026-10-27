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
  reviewCount,
  open,
  onNavigate,
}: {
  role: Role;
  name: string;
  appVersion: string;
  /** Pending items on the Check-in review list (admins only). */
  reviewCount: number;
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
              {group.items.map((item) => {
                // "/checkin" must not also light up for "/checkin-review".
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                const badge = item.href === "/checkin-review" ? reviewCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`navlink ${active ? "active" : ""}`}
                    style={badge > 0 ? { display: "flex", alignItems: "center", justifyContent: "space-between" } : undefined}
                  >
                    {item.label}
                    {badge > 0 && (
                      <span className="badge badge-amber" aria-label={`${badge} to review`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
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
