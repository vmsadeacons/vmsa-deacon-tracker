"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChipMultiSelect from "./ChipMultiSelect";
import PhotoEditor from "./PhotoEditor";
import { DEACON_RANKS, SERVICE_TYPES, SERVICE_LABELS } from "@/lib/constants";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import { updateMyProfileAction, setMyPhotoAction, deleteMyPhotoAction } from "@/app/(app)/profile/actions";

export default function MyProfileClient({
  deacon,
  locations,
}: {
  deacon: DeaconWithAgeGroup;
  locations: LocationRow[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(deacon.phone ?? "");
  const [address, setAddress] = useState(deacon.address ?? "");
  const [city, setCity] = useState(deacon.city ?? "");
  const [email, setEmail] = useState(deacon.email ?? "");
  const [dob, setDob] = useState(deacon.dob ?? "");
  const [rank, setRank] = useState(deacon.rank);
  const [dateOfOrdination, setDateOfOrdination] = useState(deacon.date_of_ordination ?? "");
  const [locationPrefs, setLocationPrefs] = useState<string[]>(deacon.location_prefs);
  const [liturgyPrefs, setLiturgyPrefs] = useState<string[]>(deacon.liturgy_prefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      rank,
      dateOfOrdination: dateOfOrdination || null,
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

  return (
    <div>
      <h1>My Profile</h1>
      <div className="card">
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Name: <strong>{deacon.name}</strong> (set by an admin)
        </p>

        <PhotoEditor
          deaconId={deacon.id}
          firstName={deacon.first_name}
          lastName={deacon.last_name}
          hasPhoto={deacon.has_photo}
          onUpload={setMyPhotoAction}
          onDelete={deleteMyPhotoAction}
        />

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-2">
            <div className="field">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>Date of birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
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
