/** "5 (50%)" against a total, or just the plain count when there's no attendance to divide by. */
export function withPercent(count: number, total: number): string {
  if (total <= 0) return String(count);
  return `${count} (${Math.round((count / total) * 100)}%)`;
}
