"use client";

import { useState } from "react";
import PublicProfileForm from "./PublicProfileForm";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import type { NameMatch, PublicDeaconProfile, PublicProfileInput } from "@/lib/repo/publicProfile";
import {
  searchDeaconsByNameAction,
  getPublicDeaconProfileAction,
  submitNewProfileAction,
  submitProfileUpdateAction,
  setPublicDeaconPhotoAction,
} from "@/app/update-profile/actions";

type Step = "name" | "matches" | "form" | "done";

export default function UpdateProfileClient({
  locations,
  ranks,
  ageGroupThresholds,
}: {
  locations: LocationRow[];
  ranks: RankRow[];
  ageGroupThresholds: { youthMin: number; adultMin: number };
}) {
  const [step, setStep] = useState<Step>("name");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<PublicDeaconProfile | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSearching(true);
    const results = await searchDeaconsByNameAction(firstName.trim(), lastName.trim());
    setMatches(results);
    setSearching(false);
    setStep("matches");
  }

  async function handlePickMatch(id: string) {
    setLoadingProfile(true);
    const fetched = await getPublicDeaconProfileAction(id);
    setLoadingProfile(false);
    if (!fetched) return; // record went away (e.g. archived) between search and pick -- stay on this step
    setProfile(fetched);
    setIsNew(false);
    setStep("form");
  }

  function handleNoneOfThese() {
    setProfile(null);
    setIsNew(true);
    setStep("form");
  }

  async function handleFormSubmit(input: PublicProfileInput, pendingPhotoDataUrl: string | null) {
    if (isNew) {
      const result = await submitNewProfileAction(input);
      if (!result.ok) return result;
      if (pendingPhotoDataUrl) {
        await setPublicDeaconPhotoAction(result.id, pendingPhotoDataUrl);
      }
      setStep("done");
      return { ok: true as const };
    }
    if (!profile) return { ok: false as const, error: "Something went wrong — please start over." };
    const result = await submitProfileUpdateAction(profile.id, input);
    if (!result.ok) return result;
    setStep("done");
    return { ok: true as const };
  }

  function startOver() {
    setStep("name");
    setFirstName("");
    setLastName("");
    setMatches([]);
    setProfile(null);
    setIsNew(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Update Your Profile</h1>

      {step === "name" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Enter your full name so we can find your record, or start a new one if you don&apos;t have one yet.
          </p>
          <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="grid-2">
              <div className="field">
                <label>First name</label>
                <input required autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="field">
                <label>Last name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={searching}>
              {searching ? "Searching…" : "Continue"}
            </button>
          </form>
        </div>
      )}

      {step === "matches" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Is one of these you?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start" }}
                disabled={loadingProfile}
                onClick={() => handlePickMatch(m.id)}
              >
                {m.firstName} {m.lastName}
              </button>
            ))}
            {matches.length === 0 && <p className="muted">No close matches found.</p>}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("name")}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={loadingProfile} onClick={handleNoneOfThese}>
              None of these are me
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{isNew ? "New profile" : "Update your profile"}</h3>
          <PublicProfileForm
            initial={profile}
            locations={locations}
            ranks={ranks}
            ageGroupThresholds={ageGroupThresholds}
            onSubmit={handleFormSubmit}
            onCancel={() => setStep(isNew ? "matches" : "matches")}
          />
        </div>
      )}

      {step === "done" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Thank you!</h3>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Your profile has been {isNew ? "created" : "updated"}. You can close this page now.
          </p>
          <button type="button" className="btn btn-secondary" onClick={startOver}>
            Update another profile
          </button>
        </div>
      )}
    </div>
  );
}
