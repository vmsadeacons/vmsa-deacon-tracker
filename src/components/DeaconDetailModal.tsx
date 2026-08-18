"use client";

import Modal from "./Modal";
import DeaconAvatar from "./DeaconAvatar";
import { formatPhone, telHref, smsHref } from "@/lib/formatPhone";
import { SERVICE_LABELS, ALL_SENTINEL, type ServiceTypeCode } from "@/lib/constants";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";

function prefLabel(pref: string, locations: LocationRow[]): string {
  if (pref === ALL_SENTINEL) return "All";
  return locations.find((l) => l.id === pref)?.name ?? pref;
}

export default function DeaconDetailModal({
  deacon,
  locations,
  onClose,
  onEdit,
  onDelete,
}: {
  deacon: DeaconWithAgeGroup | null;
  locations: LocationRow[];
  onClose: () => void;
  onEdit: (d: DeaconWithAgeGroup) => void;
  onDelete: (d: DeaconWithAgeGroup) => void;
}) {
  if (!deacon) return null;
  return (
    <Modal open={Boolean(deacon)} onClose={onClose} title="Deacon details" wide>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <DeaconAvatar
          deaconId={deacon.id}
          hasPhoto={deacon.has_photo}
          firstName={deacon.first_name}
          lastName={deacon.last_name}
          isGuest={deacon.is_guest}
          updatedAt={deacon.updated_at}
          size={64}
        />
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem" }}>
            {deacon.name}
            {deacon.is_guest && (
              <span className="badge badge-gold" style={{ marginLeft: "0.5rem" }}>
                Guest
              </span>
            )}
          </div>
          <div className="muted">
            {deacon.age_group ?? "—"} · {deacon.rank}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Phone</div>
          {deacon.phone ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{formatPhone(deacon.phone)}</span>
              <a className="btn btn-secondary btn-sm" href={telHref(deacon.phone)}>
                Call
              </a>
              <a className="btn btn-secondary btn-sm" href={smsHref(deacon.phone)}>
                Text
              </a>
            </div>
          ) : (
            "—"
          )}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Email</div>
          {deacon.email ?? "—"}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Date of birth</div>
          {deacon.dob ?? "—"}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Year of ordination</div>
          {deacon.ordination_year ?? "—"}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Address</div>
          {deacon.address ?? "—"}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>City</div>
          {deacon.city ?? "—"}
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>Status</div>
          <span className={`badge ${deacon.status === "Active" ? "badge-green" : "badge-grey"}`}>
            {deacon.status}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>Location preferences</div>
        <div className="chip-row">
          {deacon.location_prefs.length === 0 && <span className="muted">None set</span>}
          {deacon.location_prefs.map((p) => (
            <span key={p} className="badge badge-wine">
              {prefLabel(p, locations)}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>Liturgy preferences</div>
        <div className="chip-row">
          {deacon.liturgy_prefs.length === 0 && <span className="muted">None set</span>}
          {deacon.liturgy_prefs.map((p) => (
            <span key={p} className="badge badge-wine">
              {p === ALL_SENTINEL ? "All" : SERVICE_LABELS[p as ServiceTypeCode] ?? p}
            </span>
          ))}
        </div>
      </div>

      {deacon.notes && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}>Notes</div>
          <p style={{ margin: 0 }}>{deacon.notes}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button className="btn btn-danger" onClick={() => onDelete(deacon)}>
          Delete
        </button>
        <button className="btn btn-primary" onClick={() => onEdit(deacon)}>
          Edit
        </button>
      </div>
    </Modal>
  );
}
