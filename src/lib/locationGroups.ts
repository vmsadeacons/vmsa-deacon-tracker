/**
 * "Virgin Mary + St Athanasius" is a combined pseudo-location for report
 * filters only -- it is never a real row in the `locations` table, since an
 * actual liturgy/attendance record always belongs to exactly one physical
 * church. Every filter that offers it resolves it against actual attendance
 * records' real location (see resolveLocationIds in lib/repo/reports.ts),
 * never against a deacon's stated location preference -- those are a
 * different concept and "combined" must always equal the sum of the two
 * real churches filtered individually, with no overlap. Resolved by exact
 * name match against the two real locations; if either church is ever
 * renamed in Settings, update the names here too.
 */
export const COMBINED_VM_SA_ID = "combined:virgin-mary+st-athanasius";
export const COMBINED_VM_SA_LABEL = "Virgin Mary + St Athanasius";
export const VIRGIN_MARY_LOCATION_NAME = "The Church of Virgin Mary";
export const ST_ATHANASIUS_LOCATION_NAME = "The Church of St. Athanasius";
