import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "SystemAdmin" && session.user.role !== "GeneralAdmin") {
    redirect("/");
  }
  return session;
}

export async function requireSystemAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "SystemAdmin") {
    redirect("/");
  }
  return session;
}

/** For use inside Server Actions, where a throw becomes a client-visible error rather than a redirect. */
export async function assertAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  if (session.user.role !== "SystemAdmin" && session.user.role !== "GeneralAdmin") {
    throw new Error("Admin access required");
  }
  return session;
}

export async function assertSystemAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  if (session.user.role !== "SystemAdmin") {
    throw new Error("System Admin access required");
  }
  return session;
}

export async function assertSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}
