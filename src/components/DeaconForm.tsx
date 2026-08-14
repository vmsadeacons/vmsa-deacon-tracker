"use client";

import { useState } from "react";
import ChipMultiSelect from "./ChipMultiSelect";
import PhotoEditor from "./PhotoEditor";
import { DEACON_RANKS, AGE_GROUPS, SERVICE_TYPES, SERVICE_LABELS } from "@/lib/constants";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import type { DeaconInput } from "@/lib/repo/deacons";
import { setDeaconPhotoAction, deleteDeaconPhotoAction } from "@/app/(app)/deacons/actions";

export default function DeaconForm({
  initial,
  locations,
  error,
  onCancel,
  onSave,
}: {
  initial: DeaconWithAgeGroup | null;
  locations: LocationRow[];
  error?: string | null;
  onCancel: () => void;
  onSave: (input: DeaconInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [nameQualifier, setNameQualifier] = useState(initial?.name_qualifier ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [rank, setRank] = useState(initial?.rank ?? DEACON_RANKS[0]);
  const [dateOfOrdination, setDateOfOrdination] = useState(initial?.date_of_ordination ?? "");
  const [isGuest, setIsGuest] = useState(initial?.is_guest ?? false);
  const [status, setStatus] = useState<"Active" | "Archived">(initial?.status ?? "Active");
  const [ageGroupOverride, setAgeGroupOverride] = useState(initial?.age_group_override ?? "");
  const [locationPrefs, setLocationPrefs] = useState<string[]>(initial?.location_prefs ?? []);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>(initial?.liturgy_prefs ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        firstName,
        lastName: lastName || null,
        nameQualifier: nameQualifier || null,
        phone: phone || null,
        dob: dob || null,
        address: address || null,
        city: city || null,
        email: email || null,
        rank,
        dateOfOrdination: dateOfOrdination || null,
        isGuest,
        status,
        ageGroupOverride: ageGroupOverride ? (ageGroupOverride as (typeof AGE_GROUPS)[number]) : null,
        locationPrefs,
        liturgyPrefs,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.status !== "Active",
  }));

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <p className="error-text">{error}</p>}

      {initial && (
        <PhotoEditor
          deaconId={initial.id}
          firstName={initial.first_name}
          lastName={initial.last_name}
          hasPhoto={initial.has_photo}
          onUpload={(dataUrl) => setDeaconPhotoAction(initial.id, dataUrl)}
          onDelete={() => deleteDeaconPhotoAction(initial.id)}
        />
      )}

      <div className="grid-2">
        <div className="field">
          <label>First name</label>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label>Name qualifier</label>
          <input
            value={nameQualifier}
            onChange={(e) => setNameQualifier(e.target.value)}
            placeholder="e.g. distinguishes two deacons with the same name"
          />
        </div>
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} />
            Guest (visiting from another church)
          </label>
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Date of birth</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="field">
          <label>Age group (used only if DOB is blank)</label>
          <select
            value={ageGroupOverride}
            onChange={(e) => setAgeGroupOverride(e.target.value)}
            disabled={Boolean(dob)}
          >
            <option value="">—</option>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Rank</label>
          <select value={rank} onChange={(e) => setRank(e.target.value as typeof rank)}>
            {DEACON_RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date of ordination</label>
          <input
            type="date"
            value={dateOfOrdination}
            onChange={(e) => setDateOfOrdination(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Archived")}>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Location preferences</label>
        <ChipMultiSelect options={locationOptions} selected={locationPrefs} onChange={setLocationPrefs} />
      </div>

      <div className="field">
        <label>Liturgy preferences</label>
        <ChipMultiSelect
          options={SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_LABELS[s] }))}
          selected={liturgyPrefs}
          onChange={setLiturgyPrefs}
        />
      </div>

      <div className="field">
        <label>Notes (admin-only, never shown to the deacon)</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

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
