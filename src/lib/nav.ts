export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly: boolean;
}

// Exact order per spec §9. Check-in is an admin page now (which liturgy is open
// right now); deacons check in through Agios Check-in, not this app.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Records",
    adminOnly: true,
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/record", label: "Record a Liturgy" },
      { href: "/checkin", label: "Check-in" },
      { href: "/passion-week", label: "Passion Week" },
      { href: "/reports", label: "Reports & Analytics" },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      { href: "/deacons", label: "Deacons" },
      { href: "/member-updates", label: "Member Updates" },
      { href: "/access", label: "Access & Roles" },
      { href: "/archive", label: "Archive" },
      { href: "/settings", label: "Settings" },
    ],
  },
  {
    label: "My space",
    adminOnly: false,
    items: [
      { href: "/profile", label: "My Profile" },
      { href: "/history", label: "My History" },
    ],
  },
];
