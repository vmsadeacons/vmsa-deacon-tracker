import { SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import { weekdayLabel, weekdayOfDateString } from "@/lib/timezone";

/**
 * How a liturgy is displayed in reports/history/the By Liturgy report
 * header: always the weekday first ("Wednesday"), then the feast name if
 * it's a special feast ("Wednesday . Nativity"), then the ordinal
 * ("Wednesday . Nativity . 1st Liturgy") but only when there's actually a
 * second liturgy to distinguish it from -- except Sunday, which always
 * gets the ordinal even if only one of its two liturgies was ever
 * recorded, since Sunday inherently has two regardless of what made it
 * into the database.
 */
export function formatLiturgyLabel(params: {
  date: string;
  serviceType: ServiceTypeCode;
  isSpecialFeast: boolean;
  feastName: string | null;
  hasSibling: boolean;
}): string {
  const { date, serviceType, isSpecialFeast, feastName, hasSibling } = params;
  const isSunday = weekdayOfDateString(date) === 0;
  const parts = [weekdayLabel(date)];
  if (isSpecialFeast && feastName) parts.push(feastName);
  if (hasSibling || isSunday) parts.push(SERVICE_LABELS[serviceType]);
  return parts.join(" . ");
}
