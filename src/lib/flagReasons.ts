export type FlagReasonCode = "no_location" | "far_away" | "church_not_mapped";
export type FlagMethodCode = "agios" | "qr";
export type FlagSelectionCode = "detected" | "selected" | "qr";

/** Feet under a thousand, otherwise miles -- the church area itself is set in feet. */
export function formatDistance(ft: number): string {
  if (ft < 1000) return `${Math.round(ft)} ft`;
  const miles = ft / 5280;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function methodLabel(method: FlagMethodCode): string {
  return method === "qr" ? "QR code" : "Agios Check-in";
}

/** Why a check-in couldn't be verified, in plain words for the review list and the alert. */
export function describeFlag(flag: {
  reason: FlagReasonCode;
  selection: FlagSelectionCode;
  distanceFt: number | null;
  locationName: string;
}): string {
  const byHand = flag.selection === "selected" ? " Chose the church by hand." : "";
  switch (flag.reason) {
    case "far_away":
      return `Was about ${flag.distanceFt === null ? "far" : formatDistance(flag.distanceFt)} from ${flag.locationName}.${byHand}`;
    case "no_location":
      return `No location was available from the phone.${byHand}`;
    case "church_not_mapped":
      return `${flag.locationName} has no map location set, so this couldn't be checked.${byHand}`;
  }
}
