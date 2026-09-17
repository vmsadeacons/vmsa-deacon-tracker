// Shared by every "search a deacon by name" box (RosterPicker and the
// Deacons roster page) -- one search string, one mode. "Full Name" matches
// today's combined name exactly as before (including any "(qualifier)");
// "First Name"/"Last Name" match just that column, so a qualifier like
// "(Markos)" can never accidentally surface someone searching "Mark".

export type NameSearchMode = "full" | "first" | "last";

export const NAME_SEARCH_MODE_LABELS: Record<NameSearchMode, string> = {
  full: "Full Name",
  first: "First Name",
  last: "Last Name",
};

export interface NameSearchable {
  name: string;
  firstName: string;
  lastName: string;
}

export function matchesNameSearch(item: NameSearchable, mode: NameSearchMode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (mode === "first") return item.firstName.toLowerCase().includes(q);
  if (mode === "last") return item.lastName.toLowerCase().includes(q);
  return item.name.toLowerCase().includes(q);
}
