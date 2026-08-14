import { query } from "@/lib/db";

export interface RankRow {
  id: string;
  name: string;
  sort_order: number;
  status: "Active" | "Inactive";
}

export async function listRanks(includeInactive = true): Promise<RankRow[]> {
  const { rows } = await query<RankRow>(
    includeInactive
      ? `select id, name, sort_order, status from ranks order by sort_order, name`
      : `select id, name, sort_order, status from ranks where status = 'Active' order by sort_order, name`
  );
  return rows;
}

export async function getDefaultRankId(): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `select id from ranks where status = 'Active' order by sort_order limit 1`
  );
  if (!rows[0]) throw new Error("No active rank exists to use as a default");
  return rows[0].id;
}

export async function createRank(name: string): Promise<RankRow> {
  const { rows } = await query<RankRow>(
    `insert into ranks (name, sort_order)
     values ($1, (select coalesce(max(sort_order), -1) + 1 from ranks))
     returning id, name, sort_order, status`,
    [name]
  );
  return rows[0];
}

export async function updateRank(
  id: string,
  patch: { name?: string; sortOrder?: number; status?: "Active" | "Inactive" }
): Promise<RankRow> {
  const { rows } = await query<RankRow>(
    `update ranks set
       name = coalesce($2, name),
       sort_order = coalesce($3, sort_order),
       status = coalesce($4, status)
     where id = $1
     returning id, name, sort_order, status`,
    [id, patch.name ?? null, patch.sortOrder ?? null, patch.status ?? null]
  );
  return rows[0];
}
