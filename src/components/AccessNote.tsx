/** One small line under a page title saying who can use the page and at what level. */
export default function AccessNote({ children, tight }: { children: React.ReactNode; tight?: boolean }) {
  return (
    <p className="muted" style={{ fontSize: "0.78rem", margin: tight ? "0.2rem 0 0" : "-0.15rem 0 1rem" }}>
      {children}
    </p>
  );
}

// The wording per page, kept together so it stays consistent.
export const ACCESS = {
  adminsView: "General Admins and System Admins · view",
  adminsEdit: "General Admins and System Admins · view and edit",
  accessRoles:
    "General Admins: view, and manage Deacon logins · System Admins: full",
  archive: "General Admins: view and preview · System Admins: also run the archive",
  settings: "General Admins: view only · System Admins: view and edit",
  myProfile: "Any signed-in user · view and edit your own record",
  myHistory: "Any signed-in user · view your own history",
} as const;
