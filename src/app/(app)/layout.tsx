import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import AuthProvider from "@/components/AuthProvider";
import { countPendingFlags } from "@/lib/repo/checkinReview";

function resolveAppVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return "dev";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // The number on the Check-in review menu item -- one small count query, admins only.
  const isAdmin = session.user.role === "SystemAdmin" || session.user.role === "GeneralAdmin";
  const reviewCount = isAdmin ? await countPendingFlags() : 0;

  return (
    <AuthProvider session={session}>
      <AppShell
        role={session.user.role}
        name={session.user.name ?? session.user.email ?? ""}
        appVersion={resolveAppVersion()}
        reviewCount={reviewCount}
      >
        {children}
      </AppShell>
    </AuthProvider>
  );
}
