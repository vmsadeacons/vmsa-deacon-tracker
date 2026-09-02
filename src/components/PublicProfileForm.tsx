"use client";

import { useState } from "react";
import PhotoEditor from "./PhotoEditor";
import ChipMultiSelect from "./ChipMultiSelect";
import { AGE_GROUPS, LITURGY_PREF_TYPES, LITURGY_PREF_LABELS } from "@/lib/constants";
import type { PublicDeaconMeta, PublicProfileInput, ConflictField } from "@/lib/repo/publicProfile";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";

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
  initialFirstName,
  initialLastName,
  locations,
  ranks,
  ageGroupThresholds,
  onSubmit,
  onCancel,
}: {
  /** null = brand-new record ("none of these are me"); otherwise just enough meta about the matched record to render the form's chrome -- never its actual data. */
  initial: PublicDeaconMeta | null;
  /** What was typed on the name-search screen -- reused here so re-entering your own name isn't required twice; never the DB's stored value. */
  initialFirstName: string;
  initialLastName: string;
  locations: LocationRow[];
  ranks: RankRow[];
  ageGroupThresholds: { youthMin: number; adultMin: number };
  onSubmit: (
    input: PublicProfileInput,
    overrideFields: string[],
    pendingPhotoDataUrl: string | null
  ) => Promise<{ ok: boolean; error?: string; conflicts?: ConflictField[] }>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [isGuest, setIsGuest] = useState(false);
  const [ageGroupOverride, setAgeGroupOverride] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [rankId, setRankId] = useState("");
  const [ordinationYear, setOrdinationYear] = useState("");
  const [locationPrefs, setLocationPrefs] = useState<string[]>([]);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every field this submission conflicted with, and which of those the
  // deacon has explicitly chosen to request an override for rather than
  // just correct. Resubmitting carries the override picks along; anything
  // still conflicting and not overridden blocks the save again.
  const [conflicts, setConflicts] = useState<ConflictField[]>([]);
  const [overrideKeys, setOverrideKeys] = useState<Set<string>>(new Set());

  function toggleOverride(key: string) {
    setOverrideKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const conflictKeys = new Set(conflicts.map((c) => c.key));
  function fieldStyle(key: string): React.CSSProperties | undefined {
    return conflictKeys.has(key)
      ? { borderColor: "var(--wine)", background: "var(--wine-bg)" }
      : undefined;
  }
  function conflictNote(fieldKey: string) {
    if (!conflictKeys.has(fieldKey)) return null;
    return (
      <div style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
        <p className="error-text" style={{ margin: "0 0 0.3rem" }}>
          This doesn&apos;t match what we already have on file.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={overrideKeys.has(fieldKey)}
            onChange={() => toggleOverride(fieldKey)}
          />
          This is correct — ask an admin to update it
        </label>
      </div>
    );
  }

  // New record: photo held until Save, applied right after creation. Matched
  // record: no photo control at all -- neither shown nor replaceable here.
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit(
        {
          firstName,
          lastName: lastName || null,
          phone: phone || null,
          dob: dob || null,
          address: address || null,
          city: city || null,
          email: initial?.emailLocked ? null : email || null,
          rankId: rankId || undefined,
          ordinationYear: ordinationYear ? Number(ordinationYear) : null,
          isGuest,
          ageGroupOverride: ageGroupOverride ? (ageGroupOverride as (typeof AGE_GROUPS)[number]) : null,
          locationPrefs,
          liturgyPrefs,
        },
        [...overrideKeys],
        pendingPhotoDataUrl
      );
      if (result.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setError("A few fields don't match our records — see below.");
      } else if (!result.ok) {
        setError(result.error ?? "Couldn't save — please try again.");
      } else {
        setConflicts([]);
      }
    } finally {
      setSaving(false);
    }
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.status !== "Active",
  }));
  const rankOptions = ranks.filter((r) => r.status === "Active");

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && <p className="error-text">{error}</p>}

      {!initial && (
        <PhotoEditor
          photoSrc={pendingPhotoDataUrl}
          firstName={firstName}
          lastName={lastName}
          onChange={async (dataUrl) => setPendingPhotoDataUrl(dataUrl)}
          onDelete={async () => setPendingPhotoDataUrl(null)}
          showDelete
        />
      )}

      <div className="grid-2">
        <div className="field">
          <label>First name</label>
          <input
            required
            value={firstName}
            style={fieldStyle("firstName")}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {conflictNote("firstName")}
        </div>
        <div className="field">
          <label>Last name</label>
          <input value={lastName} style={fieldStyle("lastName")} onChange={(e) => setLastName(e.target.value)} />
          {conflictNote("lastName")}
        </div>
      </div>

      <div className="field">
        <label>Name qualifier</label>
        <input value={initial?.nameQualifier ?? ""} disabled placeholder="(none on file)" />
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.3rem" }}>
          {initial
            ? "This was set by an admin and can't be changed here."
            : "Set by an admin after your record is created, if needed to tell you apart from someone with the same name."}
        </p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>
            Age group {dob ? "(derived from date of birth)" : !initial ? "(required)" : "(leave blank to keep as-is)"}
          </label>
          <select
            value={ageGroupOverride}
            style={fieldStyle("ageGroupOverride")}
            onChange={(e) => setAgeGroupOverride(e.target.value)}
            disabled={Boolean(dob)}
            required={!dob && !initial}
          >
            <option value="" disabled={!initial} hidden={!initial}>
              {initial ? "— leave as-is —" : "— select —"}
            </option>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {ageGroupOptionLabel(g, ageGroupThresholds)}
              </option>
            ))}
          </select>
          {conflictNote("ageGroupOverride")}
        </div>
        <div className="field">
          <label>Date of birth</label>
          <input type="date" value={dob} style={fieldStyle("dob")} onChange={(e) => setDob(e.target.value)} />
          {conflictNote("dob")}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Phone</label>
          <input value={phone} style={fieldStyle("phone")} onChange={(e) => setPhone(e.target.value)} />
          {conflictNote("phone")}
        </div>
        {initial?.emailLocked ? (
          <div className="field">
            <label>Email</label>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Locked — you already have a sign-in linked to this email. Contact an admin to change it.
            </p>
          </div>
        ) : (
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} style={fieldStyle("email")} onChange={(e) => setEmail(e.target.value)} />
            {conflictNote("email")}
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Address</label>
          <input value={address} style={fieldStyle("address")} onChange={(e) => setAddress(e.target.value)} />
          {conflictNote("address")}
        </div>
        <div className="field">
          <label>City</label>
          <input value={city} style={fieldStyle("city")} onChange={(e) => setCity(e.target.value)} />
          {conflictNote("city")}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Rank</label>
          <select value={rankId} style={fieldStyle("rankId")} onChange={(e) => setRankId(e.target.value)}>
            <option value="">{initial ? "— leave as-is —" : "— select —"}</option>
            {rankOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {conflictNote("rankId")}
        </div>
        <div className="field">
          <label>Year of ordination</label>
          <input
            type="number"
            min={1900}
            max={2100}
            value={ordinationYear}
            style={fieldStyle("ordinationYear")}
            onChange={(e) => setOrdinationYear(e.target.value)}
          />
          {conflictNote("ordinationYear")}
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
        {conflictNote("isGuest")}
      </div>

      <div className="field">
        <label>Location preferences</label>
        <ChipMultiSelect options={locationOptions} selected={locationPrefs} onChange={setLocationPrefs} />
        {conflictNote("locationPrefs")}
      </div>

      <div className="field">
        <label>Liturgy preferences</label>
        <ChipMultiSelect
          options={LITURGY_PREF_TYPES.map((s) => ({ value: s, label: LITURGY_PREF_LABELS[s] }))}
          selected={liturgyPrefs}
          onChange={setLiturgyPrefs}
        />
        {conflictNote("liturgyPrefs")}
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
