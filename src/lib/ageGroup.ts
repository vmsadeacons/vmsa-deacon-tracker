import type { AgeGroup } from "./constants";

/**
 * dob always wins when present (exact, self-updating as the deacon ages);
 * ageGroupOverride is only a fallback for when the real birthdate isn't
 * known. See spec §6.2.
 */
export function computeAgeGroup(
  dob: string | null,
  ageGroupOverride: AgeGroup | null,
  youthMin: number,
  adultMin: number,
  asOf: Date = new Date()
): AgeGroup | null {
  if (dob) {
    const age = ageInYears(dob, asOf);
    if (age < youthMin) return "Child";
    if (age < adultMin) return "Youth";
    return "Adult";
  }
  return ageGroupOverride;
}

function ageInYears(dob: string, asOf: Date): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = asOf.getUTCFullYear() - y;
  const hadBirthdayThisYear =
    asOf.getUTCMonth() + 1 > m || (asOf.getUTCMonth() + 1 === m && asOf.getUTCDate() >= d);
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
