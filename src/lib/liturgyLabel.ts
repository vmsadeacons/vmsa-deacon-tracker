import { SERVICE_LABELS, type ServiceTypeCode } from "@/lib/constants";
import { weekdayLabel } from "@/lib/timezone";

/**
 * How a liturgy is displayed in reports/history: a special feast shows as
 * "Wednesday · Nativity", with the ordinal appended ("· 1st Liturgy") only
 * when a sibling liturgy exists that day at the same location (otherwise
 * the ordinal is redundant, since there's only one liturgy to refer to).
 * A non-feast liturgy just shows its ordinal label, as before.
 */
export function formatLiturgyLabel(params: {
  date: string;
  serviceType: ServiceTypeCode;
  isSpecialFeast: boolean;
  feastName: string | null;
  hasSibling: boolean;
}): string {
  const { date, serviceType, isSpecialFeast, feastName, hasSibling } = params;
  if (isSpecialFeast && feastName) {
    const base = `${weekdayLabel(date)} · ${feastName}`;
    return hasSibling ? `${base} · ${SERVICE_LABELS[serviceType]}` : base;
  }
  return SERVICE_LABELS[serviceType];
}
