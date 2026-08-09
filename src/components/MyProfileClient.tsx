"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChipMultiSelect from "./ChipMultiSelect";
import { DEACON_RANKS, SERVICE_TYPES, SERVICE_LABELS } from "@/lib/constants";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import { updateMyProfileAction } from "@/app/(app)/profile/actions";

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
  const [rank, setRank] = useState(deacon.rank);
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
      rank,
      locationPrefs,
      liturgyPrefs,
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <h1>My Profile</h1>
      <div className="card">
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Name: <strong>{deacon.name}</strong> (set by an admin)
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-2">
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
              <select value={rank} onChange={(e) => setRank(e.target.value as typeof rank)}>
                {DEACON_RANKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Location preferences</label>
            <ChipMultiSelect
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              selected={locationPrefs}
              onChange={setLocationPrefs}
            />
          </div>

          <div className="field">
            <label>Liturgy preferences</label>
            <ChipMultiSelect
              options={SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_LABELS[s] }))}
              selected={liturgyPrefs}
              onChange={setLiturgyPrefs}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="badge badge-green">Saved</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
