import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import type { Role } from "@/lib/constants";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  linked_deacon_id: string | null;
  pin_hash: string | null;
  status: "Active" | "Disabled";
  is_primary_admin: boolean;
  last_record_location_id: string | null;
  last_checkin_location_id: string | null;
  last_report_location_id: string | null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `select * from users where lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(`select * from users where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function verifyDeaconPin(
  email: string,
  pin: string
): Promise<UserRow | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  if (user.role !== "Deacon") return null;
  if (user.status !== "Active") return null;
  if (!user.pin_hash) return null;
  const ok = await bcrypt.compare(pin, user.pin_hash);
  return ok ? user : null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Session display name: linked deacon's current name if linked, else the account's own name/email. */
export async function resolveDisplayName(user: UserRow): Promise<string> {
  if (user.linked_deacon_id) {
    const { rows } = await query<{ name: string }>(
      `select name from deacons where id = $1`,
      [user.linked_deacon_id]
    );
    if (rows[0]) return rows[0].name;
  }
  return user.name || user.email;
}

/** First non-"All" location preference of the linked deacon, if any. */
export async function resolvePrimaryLocationId(user: UserRow): Promise<string | null> {
  if (!user.linked_deacon_id) return null;
  const { rows } = await query<{ location_prefs: string[] }>(
    `select location_prefs from deacons where id = $1`,
    [user.linked_deacon_id]
  );
  const prefs = rows[0]?.location_prefs ?? [];
  const first = prefs.find((p) => p !== "All");
  return first ?? null;
}

export async function setStickyLocation(
  userId: string,
  field: "record" | "checkin" | "report",
  locationId: string
) {
  const column =
    field === "record"
      ? "last_record_location_id"
      : field === "checkin"
      ? "last_checkin_location_id"
      : "last_report_location_id";
  await query(`update users set ${column} = $1 where id = $2`, [locationId, userId]);
}
