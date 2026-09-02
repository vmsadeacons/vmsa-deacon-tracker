import { query } from "@/lib/db";
import { createDeacon, updateDeacon, getDeacon, type DeaconInput } from "@/lib/repo/deacons";
import { listLocations } from "@/lib/repo/locations";
import { listRanks } from "@/lib/repo/ranks";
import { LITURGY_PREF_LABELS, ALL_SENTINEL, type AgeGroup, type LiturgyPrefCode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Public, no-login self-service profile form ("Update Your Profile" / admin
// review at "Member Updates").
//
// This form never shows an unauthenticated visitor anyone's existing data --
// picking a name only ever returns that name (plus its qualifier), and the
// edit screen that follows starts completely blank. A deacon re-enters
// everything; a submitted value that matches (or fills in a blank) what's on
// file is applied immediately, but a value that *conflicts* with a non-blank
// value already on file is never silently applied or revealed -- it's held
// as a pending profile_override_requests row for an admin to approve or
// reject from Member Updates, where both the current and requested values
// are visible (an authenticated, accountable context, unlike the public
// form). Status and Notes are structurally impossible to set through this
// path -- not part of PublicProfileInput. Email is additionally excluded
// entirely (never even offered as a field) whenever the record already has
// an active linked login, so this form can never be used to hijack someone's
// sign-in, override request or not.
// ---------------------------------------------------------------------------

export interface NameMatch {
  id: string;
  firstName: string;
  lastName: string;
  nameQualifier: string | null;
}

/**
 * Top 5 closest first+last name matches among Active deacons, via trigram
 * similarity (pg_trgm). Returns name + qualifier only -- enough to tell two
 * "John Doe"s apart, nothing else.
 */
export async function searchDeaconsByName(firstName: string, lastName: string): Promise<NameMatch[]> {
  const q = `${firstName} ${lastName}`.trim();
  if (!q) return [];
  const { rows } = await query<{
    id: string;
    first_name: string;
    last_name: string;
    name_qualifier: string | null;
  }>(
    `select id, first_name, last_name, name_qualifier
     from deacons
     where status = 'Active'
       and similarity(first_name || ' ' || last_name, $1) > 0.2
     order by similarity(first_name || ' ' || last_name, $1) desc
     limit 5`,
    [q]
  );
  return rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    nameQualifier: r.name_qualifier,
  }));
}

export interface PublicDeaconMeta {
  id: string;
  nameQualifier: string | null;
  /** true => Email must not even be offered as an editable field on this record. */
  emailLocked: boolean;
}

/** Just enough to render the blank edit form's chrome -- never any of the record's actual data. */
export async function getPublicDeaconMeta(id: string): Promise<PublicDeaconMeta | null> {
  const { rows } = await query<{ name_qualifier: string | null; email_locked: boolean }>(
    `select d.name_qualifier,
            exists(select 1 from users u where u.linked_deacon_id = d.id and u.status = 'Active') as email_locked
     from deacons d
     where d.id = $1 and d.status = 'Active'`,
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return { id, nameQualifier: r.name_qualifier, emailLocked: r.email_locked };
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

/** "None of these are me" path -- nothing to conflict with yet, so this reuses createDeacon's own duplicate-name-qualifier detection verbatim. */
export async function createDeaconPublic(input: PublicProfileInput): Promise<{ id: string }> {
  const deacon = await createDeacon(toDeaconInput(input));
  await query(`insert into profile_update_log (deacon_id, action) values ($1, 'created')`, [deacon.id]);
  return { id: deacon.id };
}

export interface ConflictField {
  key: string;
  label: string;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  city: "City",
  dob: "Date of birth",
  ageGroupOverride: "Age group",
  rankId: "Rank",
  ordinationYear: "Year of ordination",
  isGuest: "Guest",
  locationPrefs: "Location preferences",
  liturgyPrefs: "Liturgy preferences",
};

function normText(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}
function normPhone(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}
function normArray(v: string[] | undefined): string[] {
  return [...(v ?? [])].sort();
}
function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

interface FieldResolution {
  key: string;
  label: string;
  action: "skip" | "apply" | "conflict" | "override";
  applyValue?: unknown;
  currentDisplay?: string | null;
  requestedDisplay?: string | null;
}

/** "This is me" path. See file header for the full apply-vs-conflict-vs-override design. */
export async function resolveProfileUpdate(
  deaconId: string,
  input: PublicProfileInput,
  overrideFields: string[]
): Promise<{ ok: true } | { ok: false; conflicts: ConflictField[] }> {
  const current = await getDeacon(deaconId);
  if (!current || current.status !== "Active") {
    throw new Error("This profile can no longer be updated here — please contact the head deacon.");
  }
  const { rows: emailLockRows } = await query<{ email_locked: boolean }>(
    `select exists(select 1 from users u where u.linked_deacon_id = $1 and u.status = 'Active') as email_locked`,
    [deaconId]
  );
  const emailLocked = emailLockRows[0]?.email_locked ?? false;

  const [locations, ranks] = await Promise.all([listLocations(true), listRanks(true)]);
  const locationName = (id: string) => (id === ALL_SENTINEL ? "All" : locations.find((l) => l.id === id)?.name ?? id);
  const rankName = (id: string | null) => (id ? ranks.find((r) => r.id === id)?.name ?? id : "—");
  const liturgyLabel = (code: string) =>
    code === ALL_SENTINEL ? "All" : LITURGY_PREF_LABELS[code as LiturgyPrefCode] ?? code;

  const resolutions: FieldResolution[] = [];

  function resolveText(
    key: string,
    currentVal: string | null,
    enteredVal: string | null | undefined,
    normalize: (v: string | null | undefined) => string
  ) {
    const label = FIELD_LABELS[key];
    const entered = (enteredVal ?? "").trim();
    if (!entered) {
      resolutions.push({ key, label, action: "skip" });
    } else if (!currentVal || !currentVal.trim() || normalize(entered) === normalize(currentVal)) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({ key, label, action: "override", applyValue: entered, currentDisplay: currentVal, requestedDisplay: entered });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  resolveText("firstName", current.first_name, input.firstName, normText);
  resolveText("lastName", current.last_name, input.lastName, normText);
  resolveText("phone", current.phone, input.phone, normPhone);
  resolveText("address", current.address, input.address, normText);
  resolveText("city", current.city, input.city, normText);
  if (!emailLocked) {
    resolveText("email", current.email, input.email, normText);
  }

  // dob
  {
    const key = "dob";
    const label = FIELD_LABELS[key];
    const entered = (input.dob ?? "").trim();
    if (!entered) {
      resolutions.push({ key, label, action: "skip" });
    } else if (!current.dob || entered === current.dob) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({ key, label, action: "override", applyValue: entered, currentDisplay: current.dob, requestedDisplay: entered });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  // ageGroupOverride -- irrelevant once a fresh dob is entered this time (dob always wins going forward).
  const dobEnteredThisTime = Boolean((input.dob ?? "").trim());
  {
    const key = "ageGroupOverride";
    const label = FIELD_LABELS[key];
    const entered = dobEnteredThisTime ? null : input.ageGroupOverride ?? null;
    if (!entered) {
      resolutions.push({ key, label, action: "skip" });
    } else if (!current.age_group_override || entered === current.age_group_override) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({
        key,
        label,
        action: "override",
        applyValue: entered,
        currentDisplay: current.age_group_override,
        requestedDisplay: entered,
      });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  // rankId -- every deacon always has one, so any entered value differing from it is a real conflict.
  {
    const key = "rankId";
    const label = FIELD_LABELS[key];
    const entered = input.rankId ?? "";
    if (!entered) {
      resolutions.push({ key, label, action: "skip" });
    } else if (entered === current.rank_id) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({
        key,
        label,
        action: "override",
        applyValue: entered,
        currentDisplay: rankName(current.rank_id),
        requestedDisplay: rankName(entered),
      });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  // ordinationYear
  {
    const key = "ordinationYear";
    const label = FIELD_LABELS[key];
    const entered = input.ordinationYear ?? null;
    if (entered == null) {
      resolutions.push({ key, label, action: "skip" });
    } else if (current.ordination_year == null || entered === current.ordination_year) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({
        key,
        label,
        action: "override",
        applyValue: entered,
        currentDisplay: String(current.ordination_year),
        requestedDisplay: String(entered),
      });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  // isGuest -- always a definite value, always compared.
  {
    const key = "isGuest";
    const label = FIELD_LABELS[key];
    const entered = Boolean(input.isGuest);
    if (entered === current.is_guest) {
      resolutions.push({ key, label, action: "apply", applyValue: entered });
    } else if (overrideFields.includes(key)) {
      resolutions.push({
        key,
        label,
        action: "override",
        applyValue: entered,
        currentDisplay: current.is_guest ? "Guest" : "Not a guest",
        requestedDisplay: entered ? "Guest" : "Not a guest",
      });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }

  // locationPrefs / liturgyPrefs -- compared as sets; blank selection means "no change requested."
  function resolveArray(key: "locationPrefs" | "liturgyPrefs", currentArr: string[], labelFor: (v: string) => string) {
    const label = FIELD_LABELS[key];
    const entered = normArray(input[key]);
    const currentNorm = normArray(currentArr);
    if (entered.length === 0) {
      resolutions.push({ key, label, action: "skip" });
    } else if (currentNorm.length === 0 || arraysEqual(entered, currentNorm)) {
      resolutions.push({ key, label, action: "apply", applyValue: input[key] });
    } else if (overrideFields.includes(key)) {
      resolutions.push({
        key,
        label,
        action: "override",
        applyValue: input[key],
        currentDisplay: currentNorm.map(labelFor).join(", "),
        requestedDisplay: entered.map(labelFor).join(", "),
      });
    } else {
      resolutions.push({ key, label, action: "conflict" });
    }
  }
  resolveArray("locationPrefs", current.location_prefs, locationName);
  resolveArray("liturgyPrefs", current.liturgy_prefs, liturgyLabel);

  const conflicts = resolutions.filter((r) => r.action === "conflict").map((r) => ({ key: r.key, label: r.label }));
  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }

  const patch: Record<string, unknown> = {};
  for (const r of resolutions) {
    if (r.action === "apply") patch[r.key] = r.applyValue;
  }
  if (Object.keys(patch).length > 0) {
    await updateDeacon(deaconId, patch as Partial<DeaconInput>);
  }

  for (const r of resolutions) {
    if (r.action !== "override") continue;
    await query(
      `insert into profile_override_requests
         (deacon_id, field, field_label, current_display, requested_display, requested_value_json)
       values ($1, $2, $3, $4, $5, $6)`,
      [deaconId, r.key, r.label, r.currentDisplay ?? null, r.requestedDisplay ?? null, JSON.stringify(r.applyValue)]
    );
  }

  await query(`insert into profile_update_log (deacon_id, action) values ($1, 'updated')`, [deaconId]);
  return { ok: true };
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

export interface OverrideRequestRow {
  id: string;
  deaconId: string;
  deaconName: string;
  fieldLabel: string;
  currentDisplay: string | null;
  requestedDisplay: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
}

/** For Member Updates -- both pending and already-decided requests, newest first. */
export async function listOverrideRequests(): Promise<OverrideRequestRow[]> {
  const { rows } = await query<{
    id: string;
    deacon_id: string;
    deacon_name: string | null;
    field_label: string;
    current_display: string | null;
    requested_display: string | null;
    status: "pending" | "approved" | "rejected";
    requested_at: string;
  }>(
    `select o.id, o.deacon_id, d.name as deacon_name, o.field_label, o.current_display, o.requested_display,
            o.status, o.requested_at
     from profile_override_requests o
     left join deacons d on d.id = o.deacon_id
     order by o.requested_at desc`
  );
  return rows.map((r) => ({
    id: r.id,
    deaconId: r.deacon_id,
    deaconName: r.deacon_name ?? "(deleted)",
    fieldLabel: r.field_label,
    currentDisplay: r.current_display,
    requestedDisplay: r.requested_display,
    status: r.status,
    requestedAt: r.requested_at,
  }));
}

/** Approving applies the requested value verbatim; rejecting just closes the request out. Either way it leaves 'pending' state. */
export async function decideOverrideRequest(id: string, approve: boolean): Promise<void> {
  const { rows } = await query<{ deacon_id: string; field: string; requested_value_json: string; status: string }>(
    `select deacon_id, field, requested_value_json, status from profile_override_requests where id = $1`,
    [id]
  );
  const request = rows[0];
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error("This request has already been decided");

  if (approve) {
    const value = JSON.parse(request.requested_value_json);
    await updateDeacon(request.deacon_id, { [request.field]: value } as Partial<DeaconInput>);
  }

  await query(
    `update profile_override_requests set status = $2, decided_at = now() where id = $1`,
    [id, approve ? "approved" : "rejected"]
  );
}
