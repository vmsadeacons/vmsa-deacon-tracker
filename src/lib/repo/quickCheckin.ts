import { query } from "@/lib/db";
import { churchTodayISO } from "@/lib/timezone";
import { predictServiceType } from "@/lib/repo/liturgyTimeCutoffs";
import { checkInSelf } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Quick Check-in: a public, no-login self-checkin form. Geolocation confirms
// the deacon is physically at the church (never a bare "closest of all
// locations" -- see resolveCheckinLocations below), and the configured
// per-weekday/feast time cutoffs (lib/repo/liturgyTimeCutoffs.ts) predict
// 1st vs 2nd liturgy. Submission reuses checkInSelf verbatim, so a quick
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
  const graceFt = Math.min(accuracyMeters * 3.28084, 150);
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

export interface CheckinPrediction {
  date: string;
  serviceType: ServiceTypeCode;
  isSpecialFeast: boolean;
  feastName: string | null;
}

/** Today's date, predicted 1st/2nd liturgy, and whether today is already flagged a special feast at this location (from any existing liturgy row). */
export async function getCheckinPrediction(locationId: string): Promise<CheckinPrediction> {
  const date = churchTodayISO();
  const { rows } = await query<{ is_special_feast: boolean; feast_name: string | null }>(
    `select l.is_special_feast, fn.name as feast_name
     from liturgies l
     left join feast_names fn on fn.id = l.feast_name_id
     where l.date = $1 and l.location_id = $2 and l.is_special_feast = true
     limit 1`,
    [date, locationId]
  );
  const feastRow = rows[0];
  const isSpecialFeast = Boolean(feastRow);
  const serviceType = await predictServiceType(locationId, date, isSpecialFeast);
  return { date, serviceType, isSpecialFeast, feastName: feastRow?.feast_name ?? null };
}

/** Reuses checkInSelf verbatim -- same idempotent insert the existing (authenticated) Check-in page already uses. */
export async function submitQuickCheckin(
  deaconId: string,
  locationId: string,
  serviceType: ServiceTypeCode
): Promise<void> {
  const date = churchTodayISO();
  await checkInSelf(date, locationId, serviceType, deaconId);
}
