import { query } from "@/lib/db";

export interface ActivityRow {
  id: string;
  name: string;
  allows_multiple: boolean;
  status: "Active" | "Inactive";
}

export async function listActivities(includeInactive = true): Promise<ActivityRow[]> {
  const { rows } = await query<ActivityRow>(
    includeInactive
      ? `select id, name, allows_multiple, status from activities order by name`
      : `select id, name, allows_multiple, status from activities where status = 'Active' order by name`
  );
  return rows;
}

export async function createActivity(
  name: string,
  allowsMultiple: boolean
): Promise<ActivityRow> {
  const { rows } = await query<ActivityRow>(
    `insert into activities (name, allows_multiple) values ($1, $2)
     returning id, name, allows_multiple, status`,
    [name, allowsMultiple]
  );
  return rows[0];
}

export async function updateActivity(
  id: string,
  patch: { name?: string; allowsMultiple?: boolean; status?: "Active" | "Inactive" }
): Promise<ActivityRow> {
  const { rows } = await query<ActivityRow>(
    `update activities set
       name = coalesce($2, name),
       allows_multiple = coalesce($3, allows_multiple),
       status = coalesce($4, status)
     where id = $1
     returning id, name, allows_multiple, status`,
    [id, patch.name ?? null, patch.allowsMultiple ?? null, patch.status ?? null]
  );
  return rows[0];
}
