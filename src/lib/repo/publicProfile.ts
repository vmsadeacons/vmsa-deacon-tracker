import { query } from "@/lib/db";
import { createDeacon, updateDeacon, type DeaconInput } from "@/lib/repo/deacons";
import type { AgeGroup } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Public, no-login self-service profile form (spec: "Member Updates").
//
// Everything here is reachable without authentication, so the surface is
// deliberately narrow: the search step only ever returns a name (never
// phone/email/etc.), and the create/update paths only ever accept the
// fields on PublicProfileInput below -- Status and Notes are structurally
// impossible to set through this path since they're not part of that type.
// Email is additionally re-checked server-side on every update (never
// trusting the client) so a public visitor can never use this form to
// change the email on an account that already has an active login --
// that would otherwise be a login-takeover vector.
// ---------------------------------------------------------------------------

export interface NameMatch {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Top 3 closest first+last name matches among Active deacons, via trigram
 * similarity (pg_trgm). Deliberately returns nothing beyond first/last name
 * -- this is a pre-identification step for an unauthenticated visitor, not
 * a directory lookup.
 */
export async function searchDeaconsByName(firstName: string, lastName: string): Promise<NameMatch[]> {
  const q = `${firstName} ${lastName}`.trim();
  if (!q) return [];
  const { rows } = await query<{ id: string; first_name: string; last_name: string }>(
    `select id, first_name, last_name
     from deacons
     where status = 'Active'
       and similarity(first_name || ' ' || last_name, $1) > 0.2
     order by similarity(first_name || ' ' || last_name, $1) desc
     limit 3`,
    [q]
  );
  return rows.map((r) => ({ id: r.id, firstName: r.first_name, lastName: r.last_name }));
}

export interface PublicDeaconProfile {
  id: string;
  firstName: string;
  lastName: string;
  nameQualifier: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  dob: string | null;
  ageGroupOverride: AgeGroup | null;
  rankId: string;
  ordinationYear: number | null;
  isGuest: boolean;
  locationPrefs: string[];
  liturgyPrefs: string[];
  hasPhoto: boolean;
  /** true => the Email field must stay locked; changing it here could hijack their sign-in. */
  emailLocked: boolean;
}

/** Fetches exactly the fields the public form is allowed to show/prefill -- never Status or Notes. */
export async function getPublicDeaconProfile(id: string): Promise<PublicDeaconProfile | null> {
  const { rows } = await query<{
    id: string;
    first_name: string;
    last_name: string;
    name_qualifier: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    email: string | null;
    dob: string | null;
    age_group_override: AgeGroup | null;
    rank_id: string;
    ordination_year: number | null;
    is_guest: boolean;
    location_prefs: string[];
    liturgy_prefs: string[];
    has_photo: boolean;
    email_locked: boolean;
  }>(
    `select d.id, d.first_name, d.last_name, d.name_qualifier, d.phone, d.address, d.city, d.email,
            d.dob, d.age_group_override, d.rank_id, d.ordination_year, d.is_guest,
            d.location_prefs, d.liturgy_prefs, (d.photo is not null) as has_photo,
            exists(select 1 from users u where u.linked_deacon_id = d.id and u.status = 'Active') as email_locked
     from deacons d
     where d.id = $1 and d.status = 'Active'`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    nameQualifier: r.name_qualifier,
    phone: r.phone,
    address: r.address,
    city: r.city,
    email: r.email,
    dob: r.dob,
    ageGroupOverride: r.age_group_override,
    rankId: r.rank_id,
    ordinationYear: r.ordination_year,
    isGuest: r.is_guest,
    locationPrefs: r.location_prefs,
    liturgyPrefs: r.liturgy_prefs,
    hasPhoto: r.has_photo,
    emailLocked: r.email_locked,
  };
}

export interface PublicProfileInput {
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
}

function toDeaconInput(input: PublicProfileInput): DeaconInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    nameQualifier: input.nameQualifier,
    phone: input.phone,
    address: input.address,
    city: input.city,
    email: input.email,
    dob: input.dob,
    ageGroupOverride: input.ageGroupOverride,
    rankId: input.rankId,
    ordinationYear: input.ordinationYear,
    isGuest: input.isGuest,
    locationPrefs: input.locationPrefs,
    liturgyPrefs: input.liturgyPrefs,
    // status and notes are never set here -- not part of PublicProfileInput.
  };
}

/** Public-safe photo fetch -- scoped to Active deacons only, same boundary as the rest of this file. */
export async function getPublicDeaconPhoto(id: string): Promise<Buffer | null> {
  const { rows } = await query<{ photo: Buffer | null }>(
    `select photo from deacons where id = $1 and status = 'Active'`,
    [id]
  );
  return rows[0]?.photo ?? null;
}

/** "None of these are me" path -- reuses createDeacon's own duplicate-name-qualifier detection verbatim. */
export async function createDeaconPublic(input: PublicProfileInput): Promise<{ id: string }> {
  const deacon = await createDeacon(toDeaconInput(input));
  await query(`insert into profile_update_log (deacon_id, action) values ($1, 'created')`, [deacon.id]);
  return { id: deacon.id };
}

/** "This is me" path -- Name Qualifier is never touched (the caller never sends it), and Email is re-locked server-side regardless of what the client sent. */
export async function updateDeaconPublic(id: string, input: PublicProfileInput): Promise<void> {
  const { rows } = await query<{ status: string; email_locked: boolean }>(
    `select status,
            exists(select 1 from users u where u.linked_deacon_id = $1 and u.status = 'Active') as email_locked
     from deacons where id = $1`,
    [id]
  );
  const current = rows[0];
  if (!current || current.status !== "Active") {
    throw new Error("This profile can no longer be updated here — please contact the head deacon.");
  }

  const deaconInput = toDeaconInput(input);
  delete deaconInput.nameQualifier;
  if (current.email_locked) delete deaconInput.email;

  await updateDeacon(id, deaconInput);
  await query(`insert into profile_update_log (deacon_id, action) values ($1, 'updated')`, [id]);
}

export interface ProfileUpdateLogRow {
  id: string;
  deaconId: string;
  deaconName: string; // includes the qualifier, e.g. "John Doe (Vancouver)"
  action: "created" | "updated";
  submittedAt: string;
}

/** For the admin-only "Member Updates" review page. */
export async function listProfileUpdates(): Promise<ProfileUpdateLogRow[]> {
  const { rows } = await query<{
    id: string;
    deacon_id: string;
    deacon_name: string | null;
    action: "created" | "updated";
    submitted_at: string;
  }>(
    `select l.id, l.deacon_id, d.name as deacon_name, l.action, l.submitted_at
     from profile_update_log l
     left join deacons d on d.id = l.deacon_id
     order by l.submitted_at desc`
  );
  return rows.map((r) => ({
    id: r.id,
    deaconId: r.deacon_id,
    deaconName: r.deacon_name ?? "(deleted)",
    action: r.action,
    submittedAt: r.submitted_at,
  }));
}
