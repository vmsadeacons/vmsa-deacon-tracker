/** "09:30" -> "9:30 AM" (24-hour "HH:MM" in, 12-hour clock out) -- display only. */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Minutes since midnight -> "HH:MM", clamped to the same day. */
export function minutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes on a rolling clock (can be negative or past 24h, e.g. a window that opens the evening before) -> "HH:MM" on the 24-hour wall clock. */
export function wrapMinutesToHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** 30 -> "30 minutes", 60 -> "1 hour", 90 -> "1 hour 30 minutes", 180 -> "3 hours". */
export function describeMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m > 0 || h === 0) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}
