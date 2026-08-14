function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function DeaconAvatar({
  deaconId,
  hasPhoto,
  firstName,
  lastName,
  size = 32,
  version,
}: {
  deaconId: string;
  hasPhoto: boolean;
  firstName: string;
  lastName: string;
  size?: number;
  version?: number; // bump after upload/delete to bust the browser cache
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
    background: "var(--wine-bg)",
    color: "var(--wine)",
  };

  if (hasPhoto) {
    return (
      <img
        src={`/api/deacons/${deaconId}/photo${version ? `?v=${version}` : ""}`}
        alt=""
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }
  return <div style={style}>{initialsOf(firstName, lastName)}</div>;
}
