"use client";

import { useMemo, useState } from "react";
import type { UserWithPerson } from "@/lib/repo/users";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { Role } from "@/lib/constants";
import SingleRosterPickerModal from "./SingleRosterPickerModal";

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
  // A Deacon can never sign in without a PIN, so one is required unless
  // this account already has one and the admin is just leaving it unchanged.
  const hasExistingPin = Boolean(initial?.has_pin);
  const pinRequired = pinEnabled && !hasExistingPin;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pinRequired && !pin) {
      setError("Deacons need a PIN before they can sign in -- enter one to continue.");
      return;
    }
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
        <SingleRosterPickerModal
          items={availableDeacons.map((d) => ({ id: d.id, name: d.name }))}
          selectedId={linkedDeaconId || null}
          onSelect={(id) => setLinkedDeaconId(id ?? "")}
          placeholder="— Not tied to a deacon record —"
          title="Choose a deacon"
          idPrefix="grant-access"
        />
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
          {(actorIsSystemAdmin || initial?.role === "GeneralAdmin") && (
            <option value="GeneralAdmin">General Admin</option>
          )}
          {actorIsSystemAdmin && <option value="SystemAdmin">System Admin</option>}
        </select>
      </div>

      <div className="field">
        <label>
          PIN {pinRequired ? "(required)" : hasExistingPin ? "(leave blank to keep unchanged)" : ""}
        </label>
        <input
          type="password"
          inputMode="numeric"
          required={pinRequired}
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
