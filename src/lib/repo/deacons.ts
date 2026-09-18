import { query, withTransaction } from "@/lib/db";
import { computeAgeGroup } from "@/lib/ageGroup";
import type { AgeGroup, Role } from "@/lib/constants";
import { deleteUserInTx, disableLinkedUserIfAllowed } from "@/lib/repo/users";
import { getAppSettings } from "@/lib/repo/settings";
import { getDefaultRankId } from "@/lib/repo/ranks";

// Deliberately never includes `photo` -- bulk/list queries stay lightweight;
// photo bytes are only ever fetched one at a time via getDeaconPhoto(), served
// through /api/deacons/[id]/photo. `has_photo` is enough for list screens to
// know whether to render a thumbnail. `rank` is the joined, readable name;
// `rank_id` is the FK, needed by the edit form's picker.
const DEACON_SELECT = `
  select d.id, d.first_name, d.last_name, d.name_qualifier, d.name, d.phone, d.address, d.city,
         d.email, d.dob, d.age_group_override, d.rank_id, r.name as rank, d.ordination_year,
         d.is_guest, (d.photo is not null) as has_photo, d.location_prefs, d.liturgy_prefs,
         d.notes, d.status, d.created_at, d.updated_at
  from deacons d
  left join ranks r on r.id = d.rank_id
`;

export interface DeaconRow {
  id: string;
  first_name: string;
  last_name: string;
  name_qualifier: string | null;
  name: string; // generated: "First Last" or "First Last (Qualifier)"
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  dob: string | null;
  age_group_override: AgeGroup | null;
  rank_id: string;
  rank: string;
  ordination_year: number | null;
  is_guest: boolean;
  has_photo: boolean;
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

function withAgeGroup(
  d: DeaconRow,
  youthMin: number,
  adultMin: number
): DeaconWithAgeGroup {
  return {
    ...d,
    age_group: computeAgeGroup(d.dob, d.age_group_override, youthMin, adultMin),
  };
}

/** Batches the age-threshold lookup once for the whole list — never per row (spec §8.1). */
export async function listDeacons(includeArchived = true): Promise<DeaconWithAgeGroup[]> {
  const settings = await getAppSettings();
  const { rows } = await query<DeaconRow>(
    includeArchived
      ? `${DEACON_SELECT} order by d.name`
      : `${DEACON_SELECT} where d.status = 'Active' order by d.name`
  );
  return rows.map((d) => withAgeGroup(d, settings.ageGroupYouthMin, settings.ageGroupAdultMin));
}

export async function getDeacon(id: string): Promise<DeaconWithAgeGroup | null> {
  const settings = await getAppSettings();
  const { rows } = await query<DeaconRow>(`${DEACON_SELECT} where d.id = $1`, [id]);
  const d = rows[0];
  if (!d) return null;
  return withAgeGroup(d, settings.ageGroupYouthMin, settings.ageGroupAdultMin);
}

export async function getDeaconPhoto(id: string): Promise<Buffer | null> {
  const { rows } = await query<{ photo: Buffer | null }>(
    `select photo from deacons where id = $1`,
    [id]
  );
  return rows[0]?.photo ?? null;
}

export async function setDeaconPhoto(id: string, photo: Buffer): Promise<void> {
  await query(`update deacons set photo = $2 where id = $1`, [id, photo]);
}

export async function deleteDeaconPhoto(id: string): Promise<void> {
  await query(`update deacons set photo = null where id = $1`, [id]);
}

export interface DeaconInput {
  firstName: string;
  lastName?: string | null;
  nameQualifier?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  dob?: string | null;
  ageGroupOverride?: AgeGroup | null;
  rankId?: string;
  ordinationYear?: number | null;
  isGuest?: boolean;
  locationPrefs?: string[];
  liturgyPrefs?: string[];
  notes?: string | null;
  status?: "Active" | "Archived";
}

/**
 * Age group must always be determinable -- either a real DOB, or the
 * manual override (used as a fallback when DOB is unknown). Enforced here
 * too, not just by the form, so the Dashboard's Missing Information count
 * can rely on it and stay removed (rather than needing to keep auditing
 * for a state the app no longer allows).
 */
export function assertHasAgeGroup(dob: string | null, ageGroupOverride: AgeGroup | null) {
  if (!dob && !ageGroupOverride) {
    throw new Error("Age group is required when there's no date of birth on file");
  }
}

export function friendlyDuplicateError(err: unknown): never {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  ) {
    throw new Error(
      "A deacon with this exact First + Last name and Qualifier already exists — add or adjust the Name Qualifier to tell them apart."
    );
  }
  throw err;
}

async function fetchById(id: string): Promise<DeaconRow | undefined> {
  const { rows } = await query<DeaconRow>(`${DEACON_SELECT} where d.id = $1`, [id]);
  return rows[0];
}

export async function createDeacon(input: DeaconInput): Promise<DeaconRow> {
  assertHasAgeGroup(input.dob ?? null, input.ageGroupOverride ?? null);
  const rankId = input.rankId ?? (await getDefaultRankId());
  try {
    const { rows } = await query<{ id: string }>(
      `insert into deacons
         (first_name, last_name, name_qualifier, phone, address, city, email, dob,
          age_group_override, rank_id, ordination_year, is_guest, location_prefs, liturgy_prefs, notes, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12,false),$13,$14,$15,coalesce($16,'Active'))
       returning id`,
      [
        input.firstName,
        input.lastName ?? "",
        input.nameQualifier ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.city ?? null,
        input.email ?? null,
        input.dob ?? null,
        input.ageGroupOverride ?? null,
        rankId,
        input.ordinationYear ?? null,
        input.isGuest ?? null,
        input.locationPrefs ?? [],
        input.liturgyPrefs ?? [],
        input.notes ?? null,
        input.status ?? null,
      ]
    );
    return (await fetchById(rows[0].id))!;
  } catch (err) {
    friendlyDuplicateError(err);
  }
}

/** One record, whoever edited it last wins (admin guess or the deacon's own edit) — spec §6.8. */
export async function updateDeacon(id: string, input: Partial<DeaconInput>): Promise<DeaconRow> {
  const d = await fetchById(id);
  if (!d) throw new Error("Deacon not found");

  assertHasAgeGroup(
    input.dob !== undefined ? input.dob : d.dob,
    input.ageGroupOverride !== undefined ? input.ageGroupOverride : d.age_group_override
  );

  try {
    await query(
      `update deacons set
         first_name = $2, last_name = $3, name_qualifier = $4, phone = $5, address = $6, city = $7,
         email = $8, dob = $9, age_group_override = $10, rank_id = $11, ordination_year = $12,
         is_guest = $13, location_prefs = $14, liturgy_prefs = $15, notes = $16, status = $17
       where id = $1`,
      [
        id,
        input.firstName ?? d.first_name,
        input.lastName !== undefined ? input.lastName : d.last_name,
        input.nameQualifier !== undefined ? input.nameQualifier : d.name_qualifier,
        input.phone !== undefined ? input.phone : d.phone,
        input.address !== undefined ? input.address : d.address,
        input.city !== undefined ? input.city : d.city,
        input.email !== undefined ? input.email : d.email,
        input.dob !== undefined ? input.dob : d.dob,
        input.ageGroupOverride !== undefined ? input.ageGroupOverride : d.age_group_override,
        input.rankId ?? d.rank_id,
        input.ordinationYear !== undefined ? input.ordinationYear : d.ordination_year,
        input.isGuest !== undefined ? input.isGuest : d.is_guest,
        input.locationPrefs ?? d.location_prefs,
        input.liturgyPrefs ?? d.liturgy_prefs,
        input.notes !== undefined ? input.notes : d.notes,
        input.status ?? d.status,
      ]
    );
    return (await fetchById(id))!;
  } catch (err) {
    friendlyDuplicateError(err);
  }
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
