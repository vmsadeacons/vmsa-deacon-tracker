"use client";

import { useState } from "react";
import PhotoEditor from "./PhotoEditor";
import ChipMultiSelect from "./ChipMultiSelect";
import { AGE_GROUPS, LITURGY_PREF_TYPES, LITURGY_PREF_LABELS } from "@/lib/constants";
import type { PublicDeaconProfile, PublicProfileInput } from "@/lib/repo/publicProfile";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import { setPublicDeaconPhotoAction, deletePublicDeaconPhotoAction } from "@/app/update-profile/actions";

// Matches DeaconForm's threshold-labeled preview so the two forms describe
// age groups identically.
function ageGroupOptionLabel(
  group: (typeof AGE_GROUPS)[number],
  { youthMin, adultMin }: { youthMin: number; adultMin: number }
): string {
  if (group === "Child") return `Child (0–${Math.max(youthMin - 1, 0)})`;
  if (group === "Youth") return `Youth (${youthMin}–${Math.max(adultMin - 1, youthMin)})`;
  return `Adult (${adultMin}+)`;
}

export default function PublicProfileForm({
  initial,
  locations,
  ranks,
  ageGroupThresholds,
  onSubmit,
  onCancel,
}: {
  /** null = brand-new record ("none of these are me"); otherwise the matched record being edited. */
  initial: PublicDeaconProfile | null;
  locations: LocationRow[];
  ranks: RankRow[];
  ageGroupThresholds: { youthMin: number; adultMin: number };
  onSubmit: (
    input: PublicProfileInput,
    pendingPhotoDataUrl: string | null
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [nameQualifier, setNameQualifier] = useState(initial?.nameQualifier ?? "");
  const [isGuest, setIsGuest] = useState(initial?.isGuest ?? false);
  const [ageGroupOverride, setAgeGroupOverride] = useState(initial?.ageGroupOverride ?? "");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [rankId, setRankId] = useState(initial?.rankId ?? ranks.find((r) => r.status === "Active")?.id ?? "");
  const [ordinationYear, setOrdinationYear] = useState(
    initial?.ordinationYear ? String(initial.ordinationYear) : ""
  );
  const [locationPrefs, setLocationPrefs] = useState<string[]>(initial?.locationPrefs ?? []);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>(initial?.liturgyPrefs ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing (matched) record: photo uploads immediately. New record: held until Save.
  const [hasPhoto, setHasPhoto] = useState(initial?.hasPhoto ?? false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);

  async function handlePhotoChange(dataUrl: string) {
    if (initial) {
      await setPublicDeaconPhotoAction(initial.id, dataUrl);
      setHasPhoto(true);
      setPhotoVersion((v) => v + 1);
    } else {
      setPendingPhotoDataUrl(dataUrl);
    }
  }

  async function handlePhotoDelete() {
    if (initial) {
      await deletePublicDeaconPhotoAction(initial.id);
      setHasPhoto(false);
      setPhotoVersion((v) => v + 1);
    } else {
      setPendingPhotoDataUrl(null);
    }
  }

  const photoSrc = initial
    ? hasPhoto
      ? `/api/public-profile/${initial.id}/photo?v=${photoVersion}`
      : null
    : pendingPhotoDataUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit(
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
          ageGroupOverride: ageGroupOverride ? (ageGroupOverride as (typeof AGE_GROUPS)[number]) : null,
          locationPrefs,
          liturgyPrefs,
        },
        pendingPhotoDataUrl
      );
      if (!result.ok) setError(result.error ?? "Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.status !== "Active",
  }));
  const rankOptions = ranks.filter((r) => r.status === "Active" || r.id === initial?.rankId);

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

      <div className="field">
        <label>Name qualifier</label>
        <input
          value={nameQualifier}
          disabled={Boolean(initial)}
          onChange={(e) => setNameQualifier(e.target.value)}
          placeholder="e.g. a nickname, a city, or another way to tell you apart"
        />
        {initial ? (
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
            This was set by an admin and can&apos;t be changed here.
          </p>
        ) : (
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
            Optional — a way for the head deacon to tell you apart from someone with the same name.
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Age group {dob ? "(derived from date of birth)" : "(required)"}</label>
          <select
            value={ageGroupOverride}
            onChange={(e) => setAgeGroupOverride(e.target.value)}
            disabled={Boolean(dob)}
            required={!dob}
          >
            {!dob && (
              <option value="" disabled hidden>
                — select —
              </option>
            )}
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {ageGroupOptionLabel(g, ageGroupThresholds)}
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
          <input
            type="email"
            value={email}
            disabled={initial?.emailLocked}
            onChange={(e) => setEmail(e.target.value)}
          />
          {initial?.emailLocked && (
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
              Locked — you already have a sign-in linked to this email. Contact an admin to change it.
            </p>
          )}
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
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} />
          Guest
        </label>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
          For those who belong to another church and only occasionally attend Virgin Mary, St Athanasius, or
          Nativity.
        </p>
      </div>

      <div className="field">
        <label>Location preferences</label>
        <ChipMultiSelect options={locationOptions} selected={locationPrefs} onChange={setLocationPrefs} />
      </div>

      <div className="field">
        <label>Liturgy preferences</label>
        <ChipMultiSelect
          options={LITURGY_PREF_TYPES.map((s) => ({ value: s, label: LITURGY_PREF_LABELS[s] }))}
          selected={liturgyPrefs}
          onChange={setLiturgyPrefs}
        />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save my profile"}
        </button>
      </div>
    </form>
  );
}
