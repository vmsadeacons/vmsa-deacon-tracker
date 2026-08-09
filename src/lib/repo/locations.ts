import { query } from "@/lib/db";

export interface LocationRow {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

export async function listLocations(includeInactive = true): Promise<LocationRow[]> {
  const { rows } = await query<LocationRow>(
    includeInactive
      ? `select id, name, status from locations order by name`
      : `select id, name, status from locations where status = 'Active' order by name`
  );
  return rows;
}

export async function createLocation(name: string): Promise<LocationRow> {
  const { rows } = await query<LocationRow>(
    `insert into locations (name) values ($1) returning id, name, status`,
    [name]
  );
  return rows[0];
}

export async function updateLocation(
  id: string,
  patch: { name?: string; status?: "Active" | "Inactive" }
): Promise<LocationRow> {
  const { rows } = await query<LocationRow>(
    `update locations set
       name = coalesce($2, name),
       status = coalesce($3, status)
     where id = $1
     returning id, name, status`,
    [id, patch.name ?? null, patch.status ?? null]
  );
  return rows[0];
}
