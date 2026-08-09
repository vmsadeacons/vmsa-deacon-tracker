import { query, withTransaction } from "@/lib/db";
import { computeAgeGroup } from "@/lib/ageGroup";
import type { AgeGroup, DeaconRank, Role } from "@/lib/constants";
import { deleteUserInTx, disableLinkedUserIfAllowed } from "@/lib/repo/users";
import { getAppSettings } from "@/lib/repo/settings";

export interface DeaconRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  dob: string | null;
  age_group_override: AgeGroup | null;
  rank: DeaconRank;
  location_prefs: string[];
  liturgy_prefs: string[];
  notes: string | null;
  status: "Active" | "Archived";
  created_at: string;
  updated_at: string;
}

export interface DeaconWithAgeGroup extends DeaconRow {
  age_group: AgeGroup | null;
}

/** Batches the age-threshold lookup once for the whole list — never per row (spec §8.1). */
export async function listDeacons(includeArchived = true): Promise<DeaconWithAgeGroup[]> {
  const settings = await getAppSettings();
  const { rows } = await query<DeaconRow>(
    includeArchived
      ? `select * from deacons order by name`
      : `select * from deacons where status = 'Active' order by name`
  );
  return rows.map((d) => ({
    ...d,
    age_group: computeAgeGroup(
      d.dob,
      d.age_group_override,
      settings.ageGroupYouthMin,
      settings.ageGroupAdultMin
    ),
  }));
}

export async function getDeacon(id: string): Promise<DeaconWithAgeGroup | null> {
  const settings = await getAppSettings();
  const { rows } = await query<DeaconRow>(`select * from deacons where id = $1`, [id]);
  const d = rows[0];
  if (!d) return null;
  return {
    ...d,
    age_group: computeAgeGroup(
      d.dob,
      d.age_group_override,
      settings.ageGroupYouthMin,
      settings.ageGroupAdultMin
    ),
  };
}

export interface DeaconInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  dob?: string | null;
  ageGroupOverride?: AgeGroup | null;
  rank?: DeaconRank;
  locationPrefs?: string[];
  liturgyPrefs?: string[];
  notes?: string | null;
  status?: "Active" | "Archived";
}

export async function createDeacon(input: DeaconInput): Promise<DeaconRow> {
  const { rows } = await query<DeaconRow>(
    `insert into deacons
       (name, phone, address, city, email, dob, age_group_override, rank,
        location_prefs, liturgy_prefs, notes, status)
     values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,'Epsaltos (Hymnist)'),$9,$10,$11,coalesce($12,'Active'))
     returning *`,
    [
      input.name,
      input.phone ?? null,
      input.address ?? null,
      input.city ?? null,
      input.email ?? null,
      input.dob ?? null,
      input.ageGroupOverride ?? null,
      input.rank ?? null,
      input.locationPrefs ?? [],
      input.liturgyPrefs ?? [],
      input.notes ?? null,
      input.status ?? null,
    ]
  );
  return rows[0];
}

/** One record, whoever edited it last wins (admin guess or the deacon's own edit) — spec §6.8. */
export async function updateDeacon(id: string, input: Partial<DeaconInput>): Promise<DeaconRow> {
  const current = await query<DeaconRow>(`select * from deacons where id = $1`, [id]);
  if (!current.rows[0]) throw new Error("Deacon not found");
  const d = current.rows[0];

  const { rows } = await query<DeaconRow>(
    `update deacons set
       name = $2, phone = $3, address = $4, city = $5, email = $6, dob = $7,
       age_group_override = $8, rank = $9, location_prefs = $10, liturgy_prefs = $11,
       notes = $12, status = $13
     where id = $1
     returning *`,
    [
      id,
      input.name ?? d.name,
      input.phone !== undefined ? input.phone : d.phone,
      input.address !== undefined ? input.address : d.address,
      input.city !== undefined ? input.city : d.city,
      input.email !== undefined ? input.email : d.email,
      input.dob !== undefined ? input.dob : d.dob,
      input.ageGroupOverride !== undefined ? input.ageGroupOverride : d.age_group_override,
      input.rank ?? d.rank,
      input.locationPrefs ?? d.location_prefs,
      input.liturgyPrefs ?? d.liturgy_prefs,
      input.notes !== undefined ? input.notes : d.notes,
      input.status ?? d.status,
    ]
  );
  return rows[0];
}

/** Archiving disables (never deletes) a linked login; never blocked by that. Spec §6.6. */
export async function archiveDeacon(id: string, actorRole: Role): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`update deacons set status = 'Archived' where id = $1`, [id]);
    await disableLinkedUserIfAllowed(client, id, actorRole);
  });
}

export interface DeleteBlockedResult {
  ok: false;
  reason: string;
}

export async function deleteDeacon(
  id: string,
  actorRole: Role
): Promise<{ ok: true } | DeleteBlockedResult> {
  const { rows: countRows } = await query<{ total: string }>(
    `select
       (select count(*) from participation where deacon_id = $1) +
       (select count(*) from archive_participation where deacon_id = $1) +
       (select count(*) from passion_week_participation where deacon_id = $1)
       as total`,
    [id]
  );
  if (Number(countRows[0].total) > 0) {
    return {
      ok: false,
      reason:
        "This deacon has recorded history and can't be permanently deleted — set their status to Archived instead.",
    };
  }

  return withTransaction(async (client) => {
    const { rows: userRows } = await client.query<{ id: string }>(
      `select id from users where linked_deacon_id = $1`,
      [id]
    );
    for (const u of userRows) {
      // Throws (aborting the whole transaction) if disallowed, so the
      // deacon+user deletion is all-or-nothing per spec §6.6.
      await deleteUserInTx(client, u.id, actorRole);
    }
    await client.query(`delete from deacons where id = $1`, [id]);
    return { ok: true as const };
  });
}
