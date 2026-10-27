export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly: boolean;
}

// Exact order per spec §9. "Check-in windows" is an admin page (which liturgy is
// open right now, plus start times, extras, window timing, alert recipients and
// the QR codes); "Check-in review" lists self check-ins that couldn't be verified.
// Deacons check in through Agios Check-in or a church's QR code, not this app.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Records",
    adminOnly: true,
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/record", label: "Record a Liturgy" },
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
      { href: "/checkin-review", label: "Check-in review" },
      { href: "/checkin", label: "Check-in windows" },
      { href: "/settings", label: "System Settings" },
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
