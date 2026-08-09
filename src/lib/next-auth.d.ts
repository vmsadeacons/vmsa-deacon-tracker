import type { Role } from "@/lib/constants";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      linkedDeaconId: string | null;
      primaryLocationId: string | null;
      lastRecordLocationId: string | null;
      lastCheckinLocationId: string | null;
      lastReportLocationId: string | null;
      isPrimaryAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    linkedDeaconId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    linkedDeaconId: string | null;
    primaryLocationId: string | null;
    lastRecordLocationId: string | null;
    lastCheckinLocationId: string | null;
    lastReportLocationId: string | null;
    isPrimaryAdmin: boolean;
  }
}
