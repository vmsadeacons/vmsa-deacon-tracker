import { query } from "@/lib/db";

export interface LocationRow {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  latitude: number | null;
  longitude: number | null;
  geofence_radius_ft: number | null;
}

export async function listLocations(includeInactive = true): Promise<LocationRow[]> {
  const { rows } = await query<LocationRow>(
    includeInactive
      ? `select id, name, status, latitude, longitude, geofence_radius_ft from locations order by name`
      : `select id, name, status, latitude, longitude, geofence_radius_ft from locations where status = 'Active' order by name`
  );
  return rows;
}

export async function createLocation(name: string): Promise<LocationRow> {
  const { rows } = await query<LocationRow>(
    `insert into locations (name) values ($1) returning id, name, status, latitude, longitude, geofence_radius_ft`,
    [name]
  );
  return rows[0];
}

export async function updateLocation(
  id: string,
  patch: {
    name?: string;
    status?: "Active" | "Inactive";
    latitude?: number | null;
    longitude?: number | null;
    geofenceRadiusFt?: number | null;
  }
): Promise<LocationRow> {
  const { rows } = await query<LocationRow>(
    `update locations set
       name = coalesce($2, name),
       status = coalesce($3, status),
       latitude = coalesce($4, latitude),
       longitude = coalesce($5, longitude),
       geofence_radius_ft = coalesce($6, geofence_radius_ft)
     where id = $1
     returning id, name, status, latitude, longitude, geofence_radius_ft`,
    [id, patch.name ?? null, patch.status ?? null, patch.latitude ?? null, patch.longitude ?? null, patch.geofenceRadiusFt ?? null]
  );
  return rows[0];
}

/**
 * Sets lat/long/radius directly, allowing an explicit null to actually
 * clear a value (unlike updateLocation's coalesce-based patch, which can
 * only ever set a field, never blank it back out) -- needed for the Quick
 * Check-in geofence setup screen, where an admin may want to un-pin a
 * location.
 */
export async function setLocationGeofence(
  id: string,
  latitude: number | null,
  longitude: number | null,
  geofenceRadiusFt: number | null
): Promise<LocationRow> {
  const { rows } = await query<LocationRow>(
    `update locations set latitude = $2, longitude = $3, geofence_radius_ft = $4
     where id = $1
     returning id, name, status, latitude, longitude, geofence_radius_ft`,
    [id, latitude, longitude, geofenceRadiusFt]
  );
  return rows[0];
}
