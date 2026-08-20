import { query } from "@/lib/db";

export interface FeastNameRow {
  id: string;
  name: string;
  sort_order: number;
  status: "Active" | "Inactive";
}

export async function listFeastNames(includeInactive = true): Promise<FeastNameRow[]> {
  const { rows } = await query<FeastNameRow>(
    includeInactive
      ? `select id, name, sort_order, status from feast_names order by sort_order, name`
      : `select id, name, sort_order, status from feast_names where status = 'Active' order by sort_order, name`
  );
  return rows;
}

function friendlyDuplicateError(err: unknown): never {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  ) {
    throw new Error("A feast with this name already exists.");
  }
  throw err;
}

export async function createFeastName(name: string): Promise<FeastNameRow> {
  try {
    const { rows } = await query<FeastNameRow>(
      `insert into feast_names (name, sort_order)
       values ($1, (select coalesce(max(sort_order), -1) + 1 from feast_names))
       returning id, name, sort_order, status`,
      [name]
    );
    return rows[0];
  } catch (err) {
    friendlyDuplicateError(err);
  }
}

export async function updateFeastName(
  id: string,
  patch: { name?: string; sortOrder?: number; status?: "Active" | "Inactive" }
): Promise<FeastNameRow> {
  try {
    const { rows } = await query<FeastNameRow>(
      `update feast_names set
         name = coalesce($2, name),
         sort_order = coalesce($3, sort_order),
         status = coalesce($4, status)
       where id = $1
       returning id, name, sort_order, status`,
      [id, patch.name ?? null, patch.sortOrder ?? null, patch.status ?? null]
    );
    return rows[0];
  } catch (err) {
    friendlyDuplicateError(err);
  }
}
