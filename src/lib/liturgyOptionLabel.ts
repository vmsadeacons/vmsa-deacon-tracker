import { formatTime12 } from "@/lib/formatTime";

/** "2nd Liturgy · 6:00 PM (extra)" -- how a scheduled liturgy reads in a picker. */
export function liturgyOptionText(o: {
  label: string;
  startTime: string | null;
  startsEveningBefore: boolean;
  isExtra: boolean;
}): string {
  const time = o.startTime ? ` · ${formatTime12(o.startTime)}${o.startsEveningBefore ? " the evening before" : ""}` : "";
  return `${o.label}${time}${o.isExtra ? " (extra)" : ""}`;
}
