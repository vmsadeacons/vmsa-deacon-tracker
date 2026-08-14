import { query } from "@/lib/db";

export interface ActivityRow {
  id: string;
  name: string;
  allows_multiple: boolean;
  status: "Active" | "Inactive";
  sort_order: number;
}

export async function listActivities(includeInactive = true): Promise<ActivityRow[]> {
  const { rows } = await query<ActivityRow>(
    includeInactive
      ? `select id, name, allows_multiple, status, sort_order from activities order by sort_order, name`
      : `select id, name, allows_multiple, status, sort_order from activities where status = 'Active' order by sort_order, name`
  );
  return rows;
}

export async function createActivity(
  name: string,
  allowsMultiple: boolean
): Promise<ActivityRow> {
  const { rows } = await query<ActivityRow>(
    `insert into activities (name, allows_multiple, sort_order)
     values ($1, $2, (select coalesce(max(sort_order), -1) + 1 from activities))
     returning id, name, allows_multiple, status, sort_order`,
    [name, allowsMultiple]
  );
  return rows[0];
}

export async function updateActivity(
  id: string,
  patch: { name?: string; allowsMultiple?: boolean; status?: "Active" | "Inactive"; sortOrder?: number }
): Promise<ActivityRow> {
  const { rows } = await query<ActivityRow>(
    `update activities set
       name = coalesce($2, name),
       allows_multiple = coalesce($3, allows_multiple),
       status = coalesce($4, status),
       sort_order = coalesce($5, sort_order)
     where id = $1
     returning id, name, allows_multiple, status, sort_order`,
    [id, patch.name ?? null, patch.allowsMultiple ?? null, patch.status ?? null, patch.sortOrder ?? null]
  );
  return rows[0];
}
