import { query } from "@/lib/db";
import { checkInSelf } from "@/lib/repo/liturgies";
import { getOpenLiturgy, type OpenLiturgyInfo } from "@/lib/repo/liturgySchedule";
import { SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Quick Check-in: a public, no-login self-checkin form. Geolocation confirms
// the deacon is physically at the church (never a bare "closest of all
// locations" -- see resolveCheckinLocations below). Which liturgy they're
// checking into is never chosen by the deacon: it's the one liturgy the
// schedule currently has open at that church (lib/repo/liturgySchedule.ts).
// Submission reuses checkInSelf verbatim, so a quick
// check-in is indistinguishable from the existing self-checkin page's
// writes -- it shows up in the Dashboard, Record a Liturgy, and Reports
// exactly the same way, live.
// ---------------------------------------------------------------------------

const EARTH_RADIUS_FT = 20925646.325;

function haversineDistanceFt(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_FT * c;
}

/** Allowance for the phone's own reported GPS uncertainty, capped so a very poor fix doesn't match everything. */
function gpsGraceFt(accuracyMeters: number): number {
  return Math.min(accuracyMeters * 3.28084, 150);
}

export interface CheckinLocationMatch {
  locationId: string;
  locationName: string;
}

/**
 * Every configured location the given coordinates fall within range of --
 * "in range" means inside its admin-set radius, plus a grace allowance for
 * the phone's own reported GPS uncertainty (accuracyMeters), capped so a
 * very poor fix doesn't just match everything. Returns every match (not
 * just the nearest) so the caller can tell "not near any church" (empty)
 * apart from "genuinely ambiguous between two nearby churches" (more than
 * one) -- ambiguity is for the deacon to resolve by picking, never guessed.
 */
export async function resolveCheckinLocations(
  lat: number,
  lng: number,
  accuracyMeters: number
): Promise<CheckinLocationMatch[]> {
  const { rows } = await query<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    geofence_radius_ft: number;
  }>(
    `select id, name, latitude, longitude, geofence_radius_ft
     from locations
     where status = 'Active' and latitude is not null and longitude is not null and geofence_radius_ft is not null`
  );
  const graceFt = gpsGraceFt(accuracyMeters);
  return rows
    .filter((loc) => haversineDistanceFt(lat, lng, loc.latitude, loc.longitude) <= loc.geofence_radius_ft + graceFt)
    .map((loc) => ({ locationId: loc.id, locationName: loc.name }));
}

export interface CheckinLocationOption {
  id: string;
  name: string;
}

/**
 * Every Active location, independent of geolocation entirely -- backs the
 * manual "choose your church yourself" override, for when geolocation is
 * wrong, unavailable, or the deacon simply isn't near enough for the
 * geofence to match (spec: the automatic detection must never be the only
 * way in).
 */
export async function listActiveLocationsForCheckin(): Promise<CheckinLocationOption[]> {
  const { rows } = await query<CheckinLocationOption>(
    `select id, name from locations where status = 'Active' order by name`
  );
  return rows;
}

/** The one liturgy open for check-in at a church right now (or none, plus when the next one opens). */
export async function getCheckinOpenLiturgy(locationId: string): Promise<OpenLiturgyInfo> {
  return getOpenLiturgy(locationId);
}

export type QuickCheckinResult =
  | { ok: true; serviceType: ServiceTypeCode; label: string; flagged: boolean; flagId: string | null }
  | { ok: false; error: string };

/** What the phone reported about where it is, if it could say at all. */
export interface GpsFix {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

export type CheckinMethod = "agios" | "qr";
/** How the church was chosen: by GPS, by hand in Agios, or by scanning that church's QR code. */
export type CheckinSelection = "detected" | "selected" | "qr";
export type FlagReason = "no_location" | "far_away" | "church_not_mapped";

type Presence = { verified: true } | { verified: false; reason: FlagReason; distanceFt: number | null };

/**
 * Whether the phone's position puts the deacon at the church, worked out
 * here from the position the phone sent -- never from the phone's claim that
 * it "detected" the church. Anything short of "inside the church's area"
 * (no position at all, far away, or a church with no map location set) comes
 * back unverified, and the check-in is accepted but flagged for an admin.
 */
async function verifyPresence(locationId: string, fix: GpsFix | null): Promise<Presence> {
  const { rows } = await query<{ latitude: number | null; longitude: number | null; geofence_radius_ft: number | null }>(
    `select latitude, longitude, geofence_radius_ft from locations where id = $1`,
    [locationId]
  );
  const loc = rows[0];
  if (!loc || loc.latitude === null || loc.longitude === null || loc.geofence_radius_ft === null) {
    return { verified: false, reason: "church_not_mapped", distanceFt: null };
  }
  const usable =
    fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Number.isFinite(fix.accuracyMeters) ? fix : null;
  if (!usable) return { verified: false, reason: "no_location", distanceFt: null };
  const distanceFt = haversineDistanceFt(usable.lat, usable.lng, loc.latitude, loc.longitude);
  if (distanceFt <= loc.geofence_radius_ft + gpsGraceFt(usable.accuracyMeters)) return { verified: true };
  return { verified: false, reason: "far_away", distanceFt: Math.round(distanceFt) };
}

/**
 * The liturgy is decided here, at submit time, from the clock and the
 * schedule -- never taken from the client -- so a deacon can't check into a
 * locked liturgy by tampering with the request, and a window that closed
 * while the confirm screen was sitting open is caught. Reuses checkInSelf
 * verbatim. A check-in the server can't place inside the church is still
 * recorded (a bad phone GPS shouldn't lock anyone out) but raises a flag for
 * the admins' review list.
 */
export async function submitQuickCheckin(input: {
  deaconId: string;
  locationId: string;
  method: CheckinMethod;
  selection: CheckinSelection;
  fix: GpsFix | null;
}): Promise<QuickCheckinResult> {
  const { deaconId, locationId, method, selection, fix } = input;
  const info = await getOpenLiturgy(locationId);
  if (!info.open) {
    return { ok: false, error: "No liturgy is open for check-in at this church right now." };
  }
  const serviceType = info.open.serviceType;
  const label = SERVICE_LABELS[serviceType];

  // Already on the attendance list for this liturgy (an earlier scan, or an
  // admin recorded them): nothing new to record, so nothing new to flag.
  const { rows: already } = await query(
    `select 1 from participation p join liturgies l on l.id = p.liturgy_id
     where l.date = $1 and l.location_id = $2 and l.service_type = $3
       and p.deacon_id = $4 and p.activity_id is null`,
    [info.date, locationId, serviceType, deaconId]
  );
  if (already.length > 0) return { ok: true, serviceType, label, flagged: false, flagId: null };

  const presence = await verifyPresence(locationId, fix);
  await checkInSelf(info.date, locationId, serviceType, deaconId);
  if (presence.verified) return { ok: true, serviceType, label, flagged: false, flagId: null };

  const { rows } = await query<{ id: string }>(
    `insert into checkin_flags (deacon_id, location_id, liturgy_id, date, service_type, method, selection, reason, distance_ft)
     values ($1, $2, (select id from liturgies where date = $3 and location_id = $2 and service_type = $4), $3, $4, $5, $6, $7, $8)
     on conflict (deacon_id, liturgy_id) where status = 'pending' and liturgy_id is not null do nothing
     returning id`,
    [deaconId, locationId, info.date, serviceType, method, selection, presence.reason, presence.distanceFt]
  );
  return { ok: true, serviceType, label, flagged: true, flagId: rows[0]?.id ?? null };
}

/** A church's QR code carries its secret token; this is the only way a token turns back into a church. */
export async function resolveQrToken(token: string): Promise<CheckinLocationOption | null> {
  if (!/^[0-9a-f]{24}$/.test(token)) return null;
  const { rows } = await query<CheckinLocationOption>(
    `select id, name from locations where qr_token = $1 and status = 'Active'`,
    [token]
  );
  return rows[0] ?? null;
}
