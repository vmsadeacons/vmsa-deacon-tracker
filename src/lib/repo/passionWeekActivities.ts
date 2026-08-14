import { query } from "@/lib/db";
import type { PWActivityId } from "@/lib/constants";

export interface PWActivityRow {
  code: PWActivityId;
  label: string;
  sort_order: number;
}

/** Admin-editable label + order for the 4 fixed Passion Week activities (name/order only, set is fixed). */
export async function listPWActivities(): Promise<PWActivityRow[]> {
  const { rows } = await query<PWActivityRow>(
    `select code, label, sort_order from passion_week_activities order by sort_order`
  );
  return rows;
}

export async function updatePWActivity(code: PWActivityId, label: string, sortOrder: number): Promise<void> {
  await query(`update passion_week_activities set label = $2, sort_order = $3 where code = $1`, [
    code,
    label,
    sortOrder,
  ]);
}
