"use client";

import { useState } from "react";
import PublicProfileForm from "./PublicProfileForm";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import type { NameMatch, PublicDeaconMeta, PublicProfileInput, ConflictField } from "@/lib/repo/publicProfile";
import {
  searchDeaconsByNameAction,
  getPublicDeaconMetaAction,
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
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [meta, setMeta] = useState<PublicDeaconMeta | null>(null);
  const [isNew, setIsNew] = useState(false);
  // The matched record's actual name (not just what was typed to search) --
  // shown locked in the form, since first/last name can't be changed once
  // matched to an existing record.
  const [matchedName, setMatchedName] = useState<{ firstName: string; lastName: string } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSearching(true);
    const results = await searchDeaconsByNameAction(firstName.trim(), lastName.trim());
    setMatches(results);
    setSearching(false);
    setStep("matches");
  }

  async function handlePickMatch(match: NameMatch) {
    setLoadingMeta(true);
    const fetched = await getPublicDeaconMetaAction(match.id);
    setLoadingMeta(false);
    if (!fetched) return; // record went away (e.g. archived) between search and pick -- stay on this step
    setMeta(fetched);
    setMatchedName({ firstName: match.firstName, lastName: match.lastName });
    setIsNew(false);
    setStep("form");
  }

  function handleNoneOfThese() {
    setMeta(null);
    setMatchedName(null);
    setIsNew(true);
    setStep("form");
  }

  async function handleFormSubmit(
    input: PublicProfileInput,
    overrideFields: string[],
    pendingPhotoDataUrl: string | null
  ): Promise<{ ok: boolean; error?: string; conflicts?: ConflictField[] }> {
    if (isNew) {
      const result = await submitNewProfileAction(input);
      if (!result.ok) return result;
      if (pendingPhotoDataUrl) {
        await setPublicDeaconPhotoAction(result.id, pendingPhotoDataUrl);
      }
      setStep("done");
      return { ok: true };
    }
    if (!meta) return { ok: false, error: "Something went wrong — please start over." };
    const result = await submitProfileUpdateAction(meta.id, input, overrideFields);
    if (result.conflicts && result.conflicts.length > 0) return result;
    if (!result.ok) return result;
    setStep("done");
    return { ok: true };
  }

  function startOver() {
    setStep("name");
    setFirstName("");
    setLastName("");
    setMatches([]);
    setMeta(null);
    setMatchedName(null);
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
                disabled={loadingMeta}
                onClick={() => handlePickMatch(m)}
              >
                {m.firstName} {m.lastName}
                {m.nameQualifier && ` (${m.nameQualifier})`}
              </button>
            ))}
            {matches.length === 0 && <p className="muted">No close matches found.</p>}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("name")}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={loadingMeta} onClick={handleNoneOfThese}>
              None of these are me
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{isNew ? "New profile" : "Update your profile"}</h3>
          {!isNew && (
            <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
              For your privacy, this form starts blank rather than showing what we already have on file. Fill in
              your information below — anything that doesn&apos;t match our existing records will be flagged so
              you can confirm or request a change.
            </p>
          )}
          <PublicProfileForm
            initial={meta}
            initialFirstName={matchedName?.firstName ?? firstName}
            initialLastName={matchedName?.lastName ?? lastName}
            locations={locations}
            ranks={ranks}
            ageGroupThresholds={ageGroupThresholds}
            onSubmit={handleFormSubmit}
            onCancel={() => setStep("matches")}
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
