"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChipMultiSelect from "./ChipMultiSelect";
import PhotoEditor from "./PhotoEditor";
import { AGE_GROUPS, SERVICE_TYPES, SERVICE_LABELS } from "@/lib/constants";
import type { DeaconWithAgeGroup, DeaconInput } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import { setDeaconPhotoAction, deleteDeaconPhotoAction } from "@/app/(app)/deacons/actions";

export default function DeaconForm({
  initial,
  locations,
  ranks,
  error,
  onCancel,
  onSave,
}: {
  initial: DeaconWithAgeGroup | null;
  locations: LocationRow[];
  ranks: RankRow[];
  error?: string | null;
  onCancel: () => void;
  onSave: (input: DeaconInput, pendingPhotoDataUrl: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [nameQualifier, setNameQualifier] = useState(initial?.name_qualifier ?? "");
  const [isGuest, setIsGuest] = useState(initial?.is_guest ?? false);
  const [ageGroupOverride, setAgeGroupOverride] = useState(initial?.age_group_override ?? "");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [rankId, setRankId] = useState(initial?.rank_id ?? ranks.find((r) => r.status === "Active")?.id ?? "");
  const [ordinationYear, setOrdinationYear] = useState(
    initial?.ordination_year ? String(initial.ordination_year) : ""
  );
  const [status, setStatus] = useState<"Active" | "Archived">(initial?.status ?? "Active");
  const [locationPrefs, setLocationPrefs] = useState<string[]>(initial?.location_prefs ?? []);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>(initial?.liturgy_prefs ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Existing deacon: photo uploads immediately. New deacon: held here until Save.
  const [hasPhoto, setHasPhoto] = useState(initial?.has_photo ?? false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);

  async function handlePhotoChange(dataUrl: string) {
    if (initial) {
      await setDeaconPhotoAction(initial.id, dataUrl);
      setHasPhoto(true);
      setPhotoVersion((v) => v + 1);
      router.refresh();
    } else {
      setPendingPhotoDataUrl(dataUrl);
    }
  }

  async function handlePhotoDelete() {
    if (initial) {
      await deleteDeaconPhotoAction(initial.id);
      setHasPhoto(false);
      setPhotoVersion((v) => v + 1);
      router.refresh();
    } else {
      setPendingPhotoDataUrl(null);
    }
  }

  const photoSrc = initial
    ? hasPhoto
      ? `/api/deacons/${initial.id}/photo?v=${photoVersion}`
      : null
    : pendingPhotoDataUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          firstName,
          lastName: lastName || null,
          nameQualifier: nameQualifier || null,
          phone: phone || null,
          dob: dob || null,
          address: address || null,
          city: city || null,
          email: email || null,
          rankId,
          ordinationYear: ordinationYear ? Number(ordinationYear) : null,
          isGuest,
          status,
          ageGroupOverride: ageGroupOverride ? (ageGroupOverride as (typeof AGE_GROUPS)[number]) : null,
          locationPrefs,
          liturgyPrefs,
          notes: notes || null,
        },
        pendingPhotoDataUrl
      );
    } finally {
      setSaving(false);
    }
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.status !== "Active",
  }));

  const rankOptions = ranks.filter((r) => r.status === "Active" || r.id === initial?.rank_id);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <p className="error-text">{error}</p>}

      <PhotoEditor
        photoSrc={photoSrc}
        firstName={firstName}
        lastName={lastName}
        onChange={handlePhotoChange}
        onDelete={handlePhotoDelete}
        showDelete
      />

      <div className="grid-2">
        <div className="field">
          <label>First name</label>
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
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
            Guest
          </label>
        </div>
      </div>

      <div className="grid-2">
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
          <label>Date of birth</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Rank</label>
          <select value={rankId} onChange={(e) => setRankId(e.target.value)}>
            {rankOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Year of ordination</label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={ordinationYear}
            onChange={(e) => setOrdinationYear(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Archived")}>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
        </select>
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
