function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function DeaconAvatar({
  deaconId,
  hasPhoto,
  firstName,
  lastName,
  isGuest = false,
  size = 32,
  updatedAt,
  version,
}: {
  deaconId: string;
  hasPhoto: boolean;
  firstName: string;
  lastName: string;
  isGuest?: boolean;
  size?: number;
  // Cache-busting key for the <img> URL. Prefer updatedAt (the deacon
  // row's own updated_at, which the DB bumps on every write including a
  // photo change) -- it's always correct without any component having to
  // remember to track it. `version` is a fallback for spots that manage
  // their own local optimistic counter (an editor mid-session, before the
  // page has re-fetched fresh server data).
  updatedAt?: string;
  version?: number;
}) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.4,
    fontWeight: 600,
    overflow: "hidden",
    background: isGuest ? "var(--gold)" : "var(--wine)",
    color: "var(--surface)",
  };

  if (hasPhoto) {
    const cacheKey = updatedAt ?? (version !== undefined ? String(version) : "");
    return (
      <img
        src={`/api/deacons/${deaconId}/photo${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ""}`}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }
  return <div style={style}>{initialsOf(firstName, lastName)}</div>;
}
