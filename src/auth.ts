import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  getUserByEmail,
  verifyDeaconPin,
  resolveDisplayName,
  resolvePrimaryLocationId,
} from "@/lib/repo/users";

const SIX_HOURS = 6 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SIX_HOURS },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      id: "deacon-pin",
      name: "Deacon PIN",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const pin = credentials?.pin as string | undefined;
        if (!email || !pin) return null;
        const user = await verifyDeaconPin(email, pin);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: await resolveDisplayName(user),
          role: user.role,
          linkedDeaconId: user.linked_deacon_id,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const dbUser = await getUserByEmail(user.email!);
      if (!dbUser) {
        return "/login?error=no-admin-account";
      }
      if (dbUser.role === "Deacon") {
        return "/login?error=deacon-google";
      }
      if (dbUser.status !== "Active") {
        return "/login?error=no-admin-account";
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // Populate once at sign-in; a session's role/links are a snapshot for
      // its lifetime, refreshed on next sign-in (matches spec §6.5's
      // accepted "next login" latency for sticky-location changes).
      if (user) {
        const dbUser =
          (await getUserByEmail(user.email!)) ??
          (() => {
            throw new Error("Signed-in user not found after signIn callback");
          })();

        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.linkedDeaconId = dbUser.linked_deacon_id;
        token.isPrimaryAdmin = dbUser.is_primary_admin;
        token.primaryLocationId = await resolvePrimaryLocationId(dbUser);
        token.lastRecordLocationId = dbUser.last_record_location_id;
        token.lastCheckinLocationId = dbUser.last_checkin_location_id;
        token.lastReportLocationId = dbUser.last_report_location_id;
        token.name = await resolveDisplayName(dbUser);
      }

      if (trigger === "update") {
        // Allow a client-triggered refresh (e.g. right after picking a
        // sticky location) without requiring a full re-login.
        const fresh = await getUserByEmail(token.email!);
        if (fresh) {
          token.lastRecordLocationId = fresh.last_record_location_id;
          token.lastCheckinLocationId = fresh.last_checkin_location_id;
          token.lastReportLocationId = fresh.last_report_location_id;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.linkedDeaconId = token.linkedDeaconId;
      session.user.primaryLocationId = token.primaryLocationId;
      session.user.lastRecordLocationId = token.lastRecordLocationId;
      session.user.lastCheckinLocationId = token.lastCheckinLocationId;
      session.user.lastReportLocationId = token.lastReportLocationId;
      session.user.isPrimaryAdmin = token.isPrimaryAdmin;
      return session;
    },
  },
});
