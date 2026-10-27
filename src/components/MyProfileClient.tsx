"use client";

import AccessNote, { ACCESS } from "./AccessNote";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ChipMultiSelect from "./ChipMultiSelect";
import PhotoEditor from "./PhotoEditor";
import { AGE_GROUPS, LITURGY_PREF_TYPES, LITURGY_PREF_LABELS } from "@/lib/constants";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import { updateMyProfileAction, setMyPhotoAction, deleteMyPhotoAction } from "@/app/(app)/profile/actions";

export default function MyProfileClient({
  deacon,
  locations,
  ranks,
}: {
  deacon: DeaconWithAgeGroup;
  locations: LocationRow[];
  ranks: RankRow[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(deacon.phone ?? "");
  const [address, setAddress] = useState(deacon.address ?? "");
  const [city, setCity] = useState(deacon.city ?? "");
  const [email, setEmail] = useState(deacon.email ?? "");
  const [dob, setDob] = useState(deacon.dob ?? "");
  const [ageGroupOverride, setAgeGroupOverride] = useState(deacon.age_group_override ?? "");
  const [rankId, setRankId] = useState(deacon.rank_id);
  const [ordinationYear, setOrdinationYear] = useState(
    deacon.ordination_year ? String(deacon.ordination_year) : ""
  );
  const [locationPrefs, setLocationPrefs] = useState<string[]>(deacon.location_prefs);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>(deacon.liturgy_prefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(deacon.has_photo);
  const [photoVersion, setPhotoVersion] = useState(0);

  async function handlePhotoChange(dataUrl: string) {
    await setMyPhotoAction(dataUrl);
    setHasPhoto(true);
    setPhotoVersion((v) => v + 1);
    router.refresh();
  }

  async function handlePhotoDelete() {
    await deleteMyPhotoAction();
    setHasPhoto(false);
    setPhotoVersion((v) => v + 1);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await updateMyProfileAction({
      phone: phone || null,
      address: address || null,
      city: city || null,
      email: email || null,
      dob: dob || null,
      ageGroupOverride: ageGroupOverride ? (ageGroupOverride as (typeof AGE_GROUPS)[number]) : null,
      rankId,
      ordinationYear: ordinationYear ? Number(ordinationYear) : null,
      locationPrefs,
      liturgyPrefs,
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.status !== "Active",
  }));

  const rankOptions = ranks.filter((r) => r.status === "Active" || r.id === deacon.rank_id);

  return (
    <div>
      <h1>My Profile</h1>
      <AccessNote>{ACCESS.myProfile}</AccessNote>
      <div className="card">
        <PhotoEditor
          photoSrc={hasPhoto ? `/api/deacons/${deacon.id}/photo?v=${encodeURIComponent(`${deacon.updated_at}.${photoVersion}`)}` : null}
          firstName={deacon.first_name}
          lastName={deacon.last_name}
          onChange={handlePhotoChange}
          onDelete={handlePhotoDelete}
          showDelete
        />

        <p className="muted" style={{ marginBottom: "1rem" }}>
          Name:{" "}
          <strong>
            {deacon.first_name} {deacon.last_name}
          </strong>{" "}
          (set by an admin)
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
            <div className="field">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="muted">Saved.</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
