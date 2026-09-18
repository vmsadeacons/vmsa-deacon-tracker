import { query, withTransaction } from "@/lib/db";
import { assertHasAgeGroup, friendlyDuplicateError } from "@/lib/repo/deacons";
import type { AgeGroup } from "@/lib/constants";

// ---------------------------------------------------------------------------
// "Merge duplicate records" (Settings, SystemAdmin-only). An admin manually
// picks two deacon records, reviews a field-by-field diff, and chooses one
// to survive; the other's history (attendance, Passion Week assignments,
// linked login, profile-update logs) is folded into the survivor and the
// duplicate row is permanently deleted. Unlike deleteDeacon(), this is
// specifically FOR records that already have history -- that's the whole
// point of the tool -- so history is moved, not treated as a blocker.
// ---------------------------------------------------------------------------

export interface MergeCandidateDetail {
  id: string;
  firstName: string;
  lastName: string;
  nameQualifier: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  dob: string | null;
  ageGroupOverride: AgeGroup | null;
  rankId: string;
  rankName: string;
  ordinationYear: number | null;
  isGuest: boolean;
  hasPhoto: boolean;
  locationPrefs: string[];
  liturgyPrefs: string[];
  notes: string | null;
  status: "Active" | "Archived";
  createdAt: string;
  participationCount: number;
  passionWeekCount: number;
  linkedUserEmail: string | null;
}

async function getMergeCandidateDetail(id: string): Promise<MergeCandidateDetail | null> {
  const { rows } = await query<{
    id: string;
    first_name: string;
    last_name: string;
    name_qualifier: string | null;
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    email: string | null;
    dob: string | null;
    age_group_override: AgeGroup | null;
    rank_id: string;
    rank_name: string;
    ordination_year: number | null;
    is_guest: boolean;
    has_photo: boolean;
    location_prefs: string[];
    liturgy_prefs: string[];
    notes: string | null;
    status: "Active" | "Archived";
    created_at: string;
    participation_count: string;
    passion_week_count: string;
    linked_user_email: string | null;
  }>(
    `select d.id, d.first_name, d.last_name, d.name_qualifier, d.name, d.phone, d.address, d.city,
            d.email, d.dob, d.age_group_override, d.rank_id, r.name as rank_name, d.ordination_year,
            d.is_guest, (d.photo is not null) as has_photo, d.location_prefs, d.liturgy_prefs,
            d.notes, d.status, d.created_at,
            (select count(*) from participation where deacon_id = d.id) as participation_count,
            (select count(*) from passion_week_participation where deacon_id = d.id) as passion_week_count,
            (select u.email from users u where u.linked_deacon_id = d.id and u.status = 'Active' limit 1) as linked_user_email
     from deacons d
     left join ranks r on r.id = d.rank_id
     where d.id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    nameQualifier: r.name_qualifier,
    name: r.name,
    phone: r.phone,
    address: r.address,
    city: r.city,
    email: r.email,
    dob: r.dob,
    ageGroupOverride: r.age_group_override,
    rankId: r.rank_id,
    rankName: r.rank_name,
    ordinationYear: r.ordination_year,
    isGuest: r.is_guest,
    hasPhoto: r.has_photo,
    locationPrefs: r.location_prefs,
    liturgyPrefs: r.liturgy_prefs,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
    participationCount: Number(r.participation_count),
    passionWeekCount: Number(r.passion_week_count),
    linkedUserEmail: r.linked_user_email,
  };
}

export interface DuplicateCandidate {
  aId: string;
  aName: string; // includes the qualifier
  aStatus: "Active" | "Archived";
  bId: string;
  bName: string;
  bStatus: "Active" | "Archived";
  reasons: string[]; // e.g. ["Same name", "Same phone"]
}

/**
 * Self-joins the roster to surface pairs that share a first+last name
 * (qualifier ignored -- that's exactly the field that's supposed to tell
 * two otherwise-identical names apart), a phone number, or an email
 * address. Purely a suggestion list for the admin to eyeball -- nothing
 * here is applied automatically. Considers every status (a duplicate is
 * just as likely to be one Active + one already-Archived record).
 */
export async function detectDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const { rows } = await query<{
    a_id: string;
    a_name: string;
    a_status: "Active" | "Archived";
    b_id: string;
    b_name: string;
    b_status: "Active" | "Archived";
    same_name: boolean;
    same_phone: boolean;
    same_email: boolean;
  }>(
    `with norm as (
       select id, name, status,
              lower(trim(first_name)) as fn, lower(trim(last_name)) as ln,
              nullif(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), '') as phone_digits,
              nullif(lower(trim(coalesce(email, ''))), '') as email_norm
       from deacons
     )
     select a.id as a_id, a.name as a_name, a.status as a_status,
            b.id as b_id, b.name as b_name, b.status as b_status,
            (a.fn = b.fn and a.ln = b.ln) as same_name,
            (
              a.phone_digits is not null and length(a.phone_digits) >= 7
              and right(a.phone_digits, 10) = right(b.phone_digits, 10)
            ) as same_phone,
            (a.email_norm is not null and a.email_norm = b.email_norm) as same_email
     from norm a
     join norm b on a.id < b.id
     where (a.fn = b.fn and a.ln = b.ln)
        or (
          a.phone_digits is not null and length(a.phone_digits) >= 7
          and right(a.phone_digits, 10) = right(b.phone_digits, 10)
        )
        or (a.email_norm is not null and a.email_norm = b.email_norm)
     order by a.name
     limit 500`
  );
  return rows.map((r) => ({
    aId: r.a_id,
    aName: r.a_name,
    aStatus: r.a_status,
    bId: r.b_id,
    bName: r.b_name,
    bStatus: r.b_status,
    reasons: [
      r.same_name && "Same name",
      r.same_phone && "Same phone",
      r.same_email && "Same email",
    ].filter((v): v is string => Boolean(v)),
  }));
}

/** Both records' full detail, for the side-by-side diff screen. Either can come back null if deleted out from under the picker. */
export async function getMergePreview(
  idA: string,
  idB: string
): Promise<{ a: MergeCandidateDetail; b: MergeCandidateDetail } | null> {
  const [a, b] = await Promise.all([getMergeCandidateDetail(idA), getMergeCandidateDetail(idB)]);
  if (!a || !b) return null;
  return { a, b };
}

export interface MergeFieldPatch {
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
  notes: string | null;
  status: "Active" | "Archived";
  /** Which record's photo (if either has one) the survivor should end up with. */
  photoFrom: "survivor" | "merged" | null;
}

export interface MergeResult {
  participationMoved: number;
  passionWeekMoved: number;
  userRelinked: boolean;
}

/**
 * Moves survivorId's or mergedId's data around so mergedId can be deleted
 * with nothing left pointing at it. All-or-nothing: any unexpected failure
 * (including the linked-login conflict below) rolls back everything.
 */
export async function mergeDeacons(
  survivorId: string,
  mergedId: string,
  patch: MergeFieldPatch,
  performedByEmail: string
): Promise<MergeResult> {
  if (survivorId === mergedId) {
    throw new Error("Choose two different records to merge.");
  }
  assertHasAgeGroup(patch.dob, patch.ageGroupOverride);

  return withTransaction(async (client) => {
    const [{ rows: survivorRows }, { rows: mergedRows }] = await Promise.all([
      client.query<{ name: string }>(`select name from deacons where id = $1 for update`, [survivorId]),
      client.query<{ name: string }>(`select name from deacons where id = $1 for update`, [mergedId]),
    ]);
    const survivorName = survivorRows[0]?.name;
    const mergedName = mergedRows[0]?.name;
    if (!survivorName || !mergedName) {
      throw new Error("One of these records no longer exists — refresh and try again.");
    }

    // A deacon can have at most one active login. If both records already
    // have one, merging would silently orphan or overwrite a real login --
    // refuse and point the admin at Access & Roles to resolve it by hand.
    const { rows: bothLinkedRows } = await client.query<{ survivor_linked: boolean; merged_linked: boolean }>(
      `select
         exists(select 1 from users where linked_deacon_id = $1 and status = 'Active') as survivor_linked,
         exists(select 1 from users where linked_deacon_id = $2 and status = 'Active') as merged_linked`,
      [survivorId, mergedId]
    );
    if (bothLinkedRows[0]?.survivor_linked && bothLinkedRows[0]?.merged_linked) {
      throw new Error(
        "Both records have an active login — remove or disable one in Access & Roles before merging."
      );
    }

    if (patch.photoFrom === "merged") {
      await client.query(
        `update deacons set photo = (select photo from deacons where id = $2) where id = $1`,
        [survivorId, mergedId]
      );
    }

    // Attendance (activity_id is null): the survivor may already have a row
    // for the same liturgy, which participation_attendance_unique forbids
    // duplicating -- move what doesn't conflict, then drop the leftover
    // duplicates (the survivor's own row for that liturgy already covers it).
    const attendanceMoved = await client.query(
      `update participation set deacon_id = $1
       where deacon_id = $2 and activity_id is null
         and not exists (
           select 1 from participation p2
           where p2.liturgy_id = participation.liturgy_id and p2.deacon_id = $1 and p2.activity_id is null
         )`,
      [survivorId, mergedId]
    );
    await client.query(`delete from participation where deacon_id = $1 and activity_id is null`, [mergedId]);

    // Assignments (activity_id not null): same idea, keyed on (liturgy, activity).
    const assignmentsMoved = await client.query(
      `update participation set deacon_id = $1
       where deacon_id = $2 and activity_id is not null
         and not exists (
           select 1 from participation p2
           where p2.liturgy_id = participation.liturgy_id and p2.activity_id = participation.activity_id and p2.deacon_id = $1
         )`,
      [survivorId, mergedId]
    );
    await client.query(`delete from participation where deacon_id = $1`, [mergedId]);

    const pwMoved = await client.query(
      `update passion_week_participation set deacon_id = $1
       where deacon_id = $2
         and not exists (
           select 1 from passion_week_participation p2
           where p2.year = passion_week_participation.year
             and p2.location_id = passion_week_participation.location_id
             and p2.service_id = passion_week_participation.service_id
             and p2.hour = passion_week_participation.hour
             and p2.activity_id = passion_week_participation.activity_id
             and p2.slot_index = passion_week_participation.slot_index
             and p2.deacon_id = $1
         )`,
      [survivorId, mergedId]
    );
    await client.query(`delete from passion_week_participation where deacon_id = $1`, [mergedId]);

    await client.query(`update archive_participation set deacon_id = $1 where deacon_id = $2`, [
      survivorId,
      mergedId,
    ]);
    await client.query(`update profile_override_requests set deacon_id = $1 where deacon_id = $2`, [
      survivorId,
      mergedId,
    ]);
    await client.query(`update profile_update_log set deacon_id = $1 where deacon_id = $2`, [
      survivorId,
      mergedId,
    ]);
    // If the record being deleted was itself the "kept" side of an earlier
    // merge, re-point those history rows onto the new survivor so the merge
    // chain reads correctly (X -> Y -> Z) and the delete below isn't blocked
    // by deacon_merge_log_survivor_id_fkey.
    await client.query(`update deacon_merge_log set survivor_id = $1 where survivor_id = $2`, [
      survivorId,
      mergedId,
    ]);

    let userRelinked = false;
    const { rows: mergedUserRows } = await client.query<{ id: string }>(
      `select id from users where linked_deacon_id = $1`,
      [mergedId]
    );
    if (mergedUserRows.length > 0) {
      await client.query(`update users set linked_deacon_id = $1 where linked_deacon_id = $2`, [
        survivorId,
        mergedId,
      ]);
      userRelinked = true;
    }

    const participationMoved = (attendanceMoved.rowCount ?? 0) + (assignmentsMoved.rowCount ?? 0);
    const passionWeekMoved = pwMoved.rowCount ?? 0;

    // Delete the merged row BEFORE applying the survivor's field patch,
    // not after. deacons_identity_unique enforces first/last/qualifier
    // uniqueness across ALL rows at once (not deferred) -- if the admin
    // chose to keep the merged record's own name/qualifier for the
    // survivor (e.g. merging "Boutros Salama" into "Boutros Salama (Deacon
    // Brampton)" while keeping the "(Deacon Brampton)" qualifier), writing
    // that identity to the survivor while the merged row still holds it
    // would collide with itself and fail with exactly that constraint.
    // Deleting first removes that collision risk entirely.
    await client.query(`delete from deacons where id = $1`, [mergedId]);

    try {
      await client.query(
        `update deacons set
           first_name = $2, last_name = $3, name_qualifier = $4, phone = $5, address = $6, city = $7,
           email = $8, dob = $9, age_group_override = $10, rank_id = $11, ordination_year = $12,
           is_guest = $13, location_prefs = $14, liturgy_prefs = $15, notes = $16, status = $17
         where id = $1`,
        [
          survivorId,
          patch.firstName,
          patch.lastName,
          patch.nameQualifier,
          patch.phone,
          patch.address,
          patch.city,
          patch.email,
          patch.dob,
          patch.ageGroupOverride,
          patch.rankId,
          patch.ordinationYear,
          patch.isGuest,
          patch.locationPrefs,
          patch.liturgyPrefs,
          patch.notes,
          patch.status,
        ]
      );
    } catch (err) {
      // Genuinely rare now that the merged row is already gone -- this only
      // fires if the chosen name/qualifier belongs to some unrelated third
      // deacon. Same friendly message updateDeacon()/createDeacon() give.
      friendlyDuplicateError(err);
    }

    // Read back the survivor's name post-update rather than concatenating
    // patch.firstName + lastName ourselves -- `name` is a generated column
    // that also folds in the name qualifier (e.g. "John Doe (Vancouver)"),
    // which a plain first+last concatenation would silently drop.
    const { rows: survivorNowRows } = await client.query<{ name: string }>(
      `select name from deacons where id = $1`,
      [survivorId]
    );

    await client.query(
      `insert into deacon_merge_log
         (survivor_id, survivor_name, merged_id, merged_name, participation_moved, passion_week_moved, user_relinked, merged_by_email)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [survivorId, survivorNowRows[0].name, mergedId, mergedName, participationMoved, passionWeekMoved, userRelinked, performedByEmail]
    );

    return { participationMoved, passionWeekMoved, userRelinked };
  });
}

export interface MergeLogRow {
  id: string;
  survivorId: string | null; // null once that surviving record is itself deleted (see 0015)
  survivorName: string;
  mergedId: string;
  mergedName: string;
  participationMoved: number;
  passionWeekMoved: number;
  userRelinked: boolean;
  mergedAt: string;
  mergedByEmail: string;
}

export async function listMergeLog(): Promise<MergeLogRow[]> {
  const { rows } = await query<{
    id: string;
    survivor_id: string | null;
    survivor_name: string;
    merged_id: string;
    merged_name: string;
    participation_moved: number;
    passion_week_moved: number;
    user_relinked: boolean;
    merged_at: string;
    merged_by_email: string;
  }>(`select * from deacon_merge_log order by merged_at desc limit 100`);
  return rows.map((r) => ({
    id: r.id,
    survivorId: r.survivor_id,
    survivorName: r.survivor_name,
    mergedId: r.merged_id,
    mergedName: r.merged_name,
    participationMoved: r.participation_moved,
    passionWeekMoved: r.passion_week_moved,
    userRelinked: r.user_relinked,
    mergedAt: r.merged_at,
    mergedByEmail: r.merged_by_email,
  }));
}
