function formatISO(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weeksBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  const days = Math.round((to - from) / 86400000);
  return Math.round(days / 7);
}

/** "Aug 1, 2026 – Aug 20, 2026 · 3 weeks", for the top of a report once both bounds are resolved to real dates. */
export function dateRangeLabel(fromISO: string | null, toISO: string | null): string | null {
  if (!fromISO || !toISO) return null;
  const weeks = weeksBetweenISO(fromISO, toISO);
  const weekWord = weeks === 1 ? "week" : "weeks";
  return `${formatISO(fromISO)} – ${formatISO(toISO)} · ${weeks} ${weekWord}`;
}
