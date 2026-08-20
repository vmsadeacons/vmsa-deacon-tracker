import bcrypt from "bcryptjs";
import { pool, query, withTransaction } from "@/lib/db";
import type { Role } from "@/lib/constants";
import type { PoolClient } from "pg";

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
  created_at: string;
}

/**
 * Client-facing shape for Access & Roles -- deliberately omits pin_hash.
 * PINs are short (a handful of digits), so shipping the bcrypt hash to the
 * browser would make them practical to brute-force offline; has_pin is all
 * the UI actually needs (to know whether "leave blank" means "no PIN
 * exists yet" or "keep the current one").
 */
export interface UserWithPerson {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  linked_deacon_id: string | null;
  has_pin: boolean;
  status: "Active" | "Disabled";
  is_primary_admin: boolean;
  created_at: string;
  person_name: string; // linked deacon's name, else own name/email
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

export async function verifyDeaconPin(email: string, pin: string): Promise<UserRow | null> {
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

export async function resolveDisplayName(user: UserRow): Promise<string> {
  if (user.linked_deacon_id) {
    const { rows } = await query<{ name: string }>(`select name from deacons where id = $1`, [
      user.linked_deacon_id,
    ]);
    if (rows[0]) return rows[0].name;
  }
  return user.name || user.email;
}

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

// ---------------------------------------------------------------------------
// Access & Roles admin
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<UserWithPerson[]> {
  const { rows } = await query<UserWithPerson>(
    `select u.id, u.email, u.name, u.role, u.linked_deacon_id, (u.pin_hash is not null) as has_pin,
            u.status, u.is_primary_admin, u.created_at,
            coalesce(d.name, u.name, u.email) as person_name
     from users u
     left join deacons d on d.id = u.linked_deacon_id
     order by person_name`
  );
  return rows;
}

/**
 * Only a SystemAdmin may touch a SystemAdmin row (spec §4). This applies to
 * editing/resetting a PIN too — including a SystemAdmin editing their own
 * row (e.g. to link a deacon record), which must stay allowed even for the
 * primary admin. The primary admin's extra protection is narrower: see
 * `canDisableOrDeleteUser` below.
 */
export function canEditUser(actorRole: Role, target: UserRow): boolean {
  if (target.role === "SystemAdmin" && actorRole !== "SystemAdmin") return false;
  return true;
}

/** The seeded primary SystemAdmin can never be disabled or deleted, by anyone, through any path (spec §4/§6.6). */
export function canDisableOrDeleteUser(actorRole: Role, target: UserRow): boolean {
  if (target.is_primary_admin) return false;
  if (target.role === "SystemAdmin" && actorRole !== "SystemAdmin") return false;
  return true;
}

/**
 * Only a SystemAdmin may grant SystemAdmin or GeneralAdmin access.
 * A GeneralAdmin may only grant/keep the Deacon role.
 */
export function canAssignRole(actorRole: Role, role: Role): boolean {
  if (actorRole === "SystemAdmin") return true;
  return role === "Deacon";
}

function roleGrantErrorMessage(role: Role): string {
  return role === "SystemAdmin"
    ? "Only a System Admin can grant System Admin access"
    : "Only a System Admin can grant General Admin access";
}

export async function grantAccess(params: {
  email: string;
  name: string | null;
  role: Role;
  linkedDeaconId: string | null;
  pin: string | null;
  actorRole: Role;
}): Promise<UserRow> {
  if (!canAssignRole(params.actorRole, params.role)) {
    throw new Error(roleGrantErrorMessage(params.role));
  }
  if (params.role === "Deacon" && !params.pin) {
    throw new Error("Deacons need a PIN before they can sign in -- set one before saving");
  }
  const pinHash = params.pin ? await hashPin(params.pin) : null;
  const { rows } = await query<UserRow>(
    `insert into users (email, name, role, linked_deacon_id, pin_hash)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [params.email, params.name, params.role, params.linkedDeaconId, pinHash]
  );
  return rows[0];
}

export async function updateUser(
  id: string,
  patch: {
    email?: string;
    role?: Role;
    linkedDeaconId?: string | null;
    pin?: string | null; // blank/undefined = leave unchanged
  },
  actorRole: Role
): Promise<UserRow> {
  const target = await getUserById(id);
  if (!target) throw new Error("User not found");
  if (!canEditUser(actorRole, target)) {
    throw new Error("Not permitted to modify this account");
  }
  if (patch.role && patch.role !== target.role && !canAssignRole(actorRole, patch.role)) {
    throw new Error(roleGrantErrorMessage(patch.role));
  }

  const newRole = patch.role ?? target.role;
  // Three distinct outcomes, so a plain coalesce() can't express this:
  // a fresh PIN -> set it; switching to an admin role -> clear it (admins
  // never sign in with a PIN); a blank PIN on a Deacon edit -> leave as-is.
  let pinHash: string | null | undefined;
  if (patch.pin && patch.pin.length > 0) {
    pinHash = await hashPin(patch.pin);
  } else if (newRole !== "Deacon") {
    pinHash = null;
  } else {
    pinHash = undefined;
  }

  if (newRole === "Deacon" && pinHash === undefined && !target.pin_hash) {
    throw new Error("Deacons need a PIN before they can sign in -- set one before saving");
  }

  const { rows } = await query<UserRow>(
    `update users set
       email = coalesce($2, email),
       role = coalesce($3, role),
       linked_deacon_id = $4,
       pin_hash = case when $6 then $5 else pin_hash end
     where id = $1
     returning *`,
    [
      id,
      patch.email ?? null,
      patch.role ?? null,
      patch.linkedDeaconId !== undefined ? patch.linkedDeaconId : target.linked_deacon_id,
      pinHash ?? null,
      pinHash !== undefined,
    ]
  );
  return rows[0];
}

export async function setUserPin(id: string, pin: string, actorRole: Role): Promise<void> {
  const target = await getUserById(id);
  if (!target) throw new Error("User not found");
  if (!canEditUser(actorRole, target)) throw new Error("Not permitted to modify this account");
  const pinHash = await hashPin(pin);
  await query(`update users set pin_hash = $2 where id = $1`, [id, pinHash]);
}

export async function setUserStatus(
  id: string,
  status: "Active" | "Disabled",
  actorRole: Role
): Promise<void> {
  const target = await getUserById(id);
  if (!target) throw new Error("User not found");
  if (!canDisableOrDeleteUser(actorRole, target)) throw new Error("Not permitted to modify this account");
  await query(`update users set status = $2 where id = $1`, [id, status]);
}

export async function deleteUser(id: string, actorRole: Role): Promise<void> {
  const target = await getUserById(id);
  if (!target) return;
  if (!canDisableOrDeleteUser(actorRole, target)) throw new Error("Not permitted to delete this account");
  await query(`delete from users where id = $1`, [id]);
}

/** Used inside the deacon-deletion transaction; throws (aborting the whole tx) if disallowed. */
export async function deleteUserInTx(
  client: PoolClient,
  userId: string,
  actorRole: Role
): Promise<void> {
  const { rows } = await client.query<UserRow>(`select * from users where id = $1`, [userId]);
  const target = rows[0];
  if (!target) return;
  if (!canDisableOrDeleteUser(actorRole, target)) {
    throw new Error("Not permitted to delete the login linked to this deacon");
  }
  await client.query(`delete from users where id = $1`, [userId]);
}

/** Used when archiving a deacon: disable (never delete) any linked login, best-effort. */
export async function disableLinkedUserIfAllowed(
  client: PoolClient,
  linkedDeaconId: string,
  actorRole: Role
): Promise<void> {
  const { rows } = await client.query<UserRow>(
    `select * from users where linked_deacon_id = $1`,
    [linkedDeaconId]
  );
  for (const target of rows) {
    if (canDisableOrDeleteUser(actorRole, target)) {
      await client.query(`update users set status = 'Disabled' where id = $1`, [target.id]);
    }
    // If not allowed (primary admin / SystemAdmin-by-non-SystemAdmin), leave as-is —
    // archiving itself is never blocked by this, per spec §6.6.
  }
}

export { pool, withTransaction };
