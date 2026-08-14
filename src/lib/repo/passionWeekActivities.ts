import { query } from "@/lib/db";
import type { PWActivityId } from "@/lib/constants";

export interface PWActivityRow {
  code: PWActivityId;
  label: string;
  sort_order: number;
  status: "Active" | "Inactive";
}

/** Admin-editable label + order for the 4 fixed Passion Week activities (name/order/status only, set is fixed). */
export async function listPWActivities(includeInactive = true): Promise<PWActivityRow[]> {
  const { rows } = await query<PWActivityRow>(
    includeInactive
      ? `select code, label, sort_order, status from passion_week_activities order by sort_order`
      : `select code, label, sort_order, status from passion_week_activities where status = 'Active' order by sort_order`
  );
  return rows;
}

export async function updatePWActivity(
  code: PWActivityId,
  patch: { label?: string; sortOrder?: number; status?: "Active" | "Inactive" }
): Promise<void> {
  await query(
    `update passion_week_activities set
       label = coalesce($2, label),
       sort_order = coalesce($3, sort_order),
       status = coalesce($4, status)
     where code = $1`,
    [code, patch.label ?? null, patch.sortOrder ?? null, patch.status ?? null]
  );
}
