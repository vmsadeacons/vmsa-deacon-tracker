/** Display-only formatting — the stored value is never modified, whatever was typed in stays as-is. */

function tenDigitsOf(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? ten : null;
}

/** "+1 (416) 930-1659" for a recognizable 10-digit North American number, else the raw value unchanged. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const ten = tenDigitsOf(raw);
  if (!ten) return raw;
  return `+1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** A dialable tel: URI — E.164 when the number parses cleanly, else the raw value. */
export function telHref(raw: string): string {
  const ten = tenDigitsOf(raw);
  return `tel:${ten ? `+1${ten}` : raw}`;
}

/** An sms: URI for the "Text" button — same number resolution as telHref. */
export function smsHref(raw: string): string {
  const ten = tenDigitsOf(raw);
  return `sms:${ten ? `+1${ten}` : raw}`;
}
