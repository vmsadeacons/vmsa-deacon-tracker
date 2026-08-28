import { ALL_SENTINEL } from "@/lib/constants";

/**
 * "Virgin Mary + St Athanasius" is a combined pseudo-location for report
 * filters only -- it is never a real row in the `locations` table, since an
 * actual liturgy/attendance record always belongs to exactly one physical
 * church. Resolved by exact name match against the two real locations; if
 * either church is ever renamed in Settings, update the names here too.
 */
export const COMBINED_VM_SA_ID = "combined:virgin-mary+st-athanasius";
export const COMBINED_VM_SA_LABEL = "Virgin Mary + St Athanasius";
export const VIRGIN_MARY_LOCATION_NAME = "The Church of Virgin Mary";
export const ST_ATHANASIUS_LOCATION_NAME = "The Church of St. Athanasius";

export function combinedLocationIds(locations: { id: string; name: string }[]): string[] {
  return locations
    .filter((l) => l.name === VIRGIN_MARY_LOCATION_NAME || l.name === ST_ATHANASIUS_LOCATION_NAME)
    .map((l) => l.id);
}

/**
 * Does this deacon's location_prefs satisfy the given Location filter value
 * (a real location id, the combined pseudo-id, or "" for no filter)?
 */
export function matchesLocationFilter(
  locationPrefs: string[],
  filterValue: string,
  combinedIds: string[]
): boolean {
  if (!filterValue) return true;
  if (locationPrefs.includes(ALL_SENTINEL)) return true;
  if (filterValue === COMBINED_VM_SA_ID) return combinedIds.some((id) => locationPrefs.includes(id));
  return locationPrefs.includes(filterValue);
}
