import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import AuthProvider from "@/components/AuthProvider";

function resolveAppVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return "dev";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AuthProvider session={session}>
      <AppShell
        role={session.user.role}
        name={session.user.name ?? session.user.email ?? ""}
        appVersion={resolveAppVersion()}
      >
        {children}
      </AppShell>
    </AuthProvider>
  );
}
