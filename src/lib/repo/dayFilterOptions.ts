import { query } from "@/lib/db";

export interface DayFilterOptionRow {
  id: string;
  label: string;
  weekdays: number[];
  is_special_feast: boolean;
  sort_order: number;
}

export async function listDayFilterOptions(): Promise<DayFilterOptionRow[]> {
  const { rows } = await query<DayFilterOptionRow>(
    `select id, label, weekdays, is_special_feast, sort_order
     from day_filter_options
     order by sort_order, label`
  );
  return rows;
}

export async function createDayFilterOption(
  label: string,
  weekdays: number[],
  isSpecialFeast: boolean
): Promise<DayFilterOptionRow> {
  const { rows } = await query<DayFilterOptionRow>(
    `insert into day_filter_options (label, weekdays, is_special_feast, sort_order)
     values ($1, $2, $3, (select coalesce(max(sort_order), -1) + 1 from day_filter_options))
     returning id, label, weekdays, is_special_feast, sort_order`,
    [label, isSpecialFeast ? [] : weekdays, isSpecialFeast]
  );
  return rows[0];
}

export async function updateDayFilterOption(
  id: string,
  patch: { label?: string; weekdays?: number[]; isSpecialFeast?: boolean; sortOrder?: number }
): Promise<DayFilterOptionRow> {
  const { rows } = await query<DayFilterOptionRow>(
    `update day_filter_options set
       label = coalesce($2, label),
       weekdays = coalesce($3, weekdays),
       is_special_feast = coalesce($4, is_special_feast),
       sort_order = coalesce($5, sort_order)
     where id = $1
     returning id, label, weekdays, is_special_feast, sort_order`,
    [id, patch.label ?? null, patch.weekdays ?? null, patch.isSpecialFeast ?? null, patch.sortOrder ?? null]
  );
  return rows[0];
}

/** Real delete, not a status toggle -- these are pure filter definitions with no recorded history to preserve. */
export async function deleteDayFilterOption(id: string): Promise<void> {
  await query(`delete from day_filter_options where id = $1`, [id]);
}
