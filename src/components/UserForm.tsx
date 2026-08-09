"use client";

import { useMemo, useState } from "react";
import type { UserWithPerson } from "@/lib/repo/users";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { Role } from "@/lib/constants";

export default function UserForm({
  initial,
  deacons,
  actorIsSystemAdmin,
  onCancel,
  onSave,
}: {
  initial: UserWithPerson | null;
  deacons: DeaconWithAgeGroup[];
  actorIsSystemAdmin: boolean;
  onCancel: () => void;
  onSave: (input: {
    email: string;
    name: string | null;
    role: Role;
    linkedDeaconId: string | null;
    pin: string | null;
  }) => Promise<void>;
}) {
  const availableDeacons = useMemo(
    () =>
      deacons.filter(
        (d) => d.status === "Active" || d.id === initial?.linked_deacon_id
      ),
    [deacons, initial]
  );

  const [linkedDeaconId, setLinkedDeaconId] = useState(initial?.linked_deacon_id ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "Deacon");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDeacon = availableDeacons.find((d) => d.id === linkedDeaconId) ?? null;
  const emailLocked = Boolean(selectedDeacon?.email);
  const effectiveEmail = emailLocked ? selectedDeacon!.email! : email;
  const pinEnabled = role === "Deacon";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        email: effectiveEmail,
        name: selectedDeacon?.name ?? null,
        role,
        linkedDeaconId: linkedDeaconId || null,
        pin: pinEnabled && pin ? pin : null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="field">
        <label>Deacon (optional)</label>
        <select value={linkedDeaconId} onChange={(e) => setLinkedDeaconId(e.target.value)}>
          <option value="">— Not tied to a deacon record —</option>
          {availableDeacons.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Email</label>
        <input
          type="email"
          required
          value={effectiveEmail}
          disabled={emailLocked}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="Deacon">Deacon</option>
          <option value="GeneralAdmin">General Admin</option>
          {actorIsSystemAdmin && <option value="SystemAdmin">System Admin</option>}
        </select>
      </div>

      <div className="field">
        <label>PIN {initial ? "(leave blank to keep unchanged)" : "(optional — can be set later)"}</label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          disabled={!pinEnabled}
          onChange={(e) => setPin(e.target.value)}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
