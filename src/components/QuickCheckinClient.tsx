"use client";

import { useEffect, useState } from "react";
import type { NameMatch } from "@/lib/repo/publicProfile";
import type { CheckinLocationMatch } from "@/lib/repo/quickCheckin";
import type { ServiceTypeCode } from "@/lib/constants";
import { SERVICE_LABELS } from "@/lib/constants";
import { weekdayLabel } from "@/lib/timezone";
import {
  searchDeaconsByNameAction,
  resolveCheckinLocationsAction,
  getCheckinPredictionAction,
  submitQuickCheckinAction,
} from "@/app/quick-checkin/actions";

const STORAGE_KEY = "quickCheckinDeacon";

interface StoredIdentity {
  id: string;
  name: string;
}

type Step = "loading" | "setup" | "locating" | "pick-location" | "no-location" | "confirm" | "done";

export default function QuickCheckinClient() {
  const [step, setStep] = useState<Step>("loading");
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);

  // Setup (first run only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [searched, setSearched] = useState(false);

  // Location
  const [locationError, setLocationError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CheckinLocationMatch[]>([]);
  const [location, setLocation] = useState<CheckinLocationMatch | null>(null);

  // Prediction / confirm
  const [date, setDate] = useState("");
  const [serviceType, setServiceType] = useState<ServiceTypeCode>("S1");
  const [isSpecialFeast, setIsSpecialFeast] = useState(false);
  const [feastName, setFeastName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function proceedToConfirm(loc: CheckinLocationMatch) {
    setLocation(loc);
    const prediction = await getCheckinPredictionAction(loc.locationId);
    setDate(prediction.date);
    setServiceType(prediction.serviceType);
    setIsSpecialFeast(prediction.isSpecialFeast);
    setFeastName(prediction.feastName);
    setSubmitError(null);
    setStep("confirm");
  }

  async function locate() {
    setLocationError(null);
    setCandidates([]);
    if (!navigator.geolocation) {
      setLocationError("This device doesn't support location detection, so we can't confirm you're at the church.");
      setStep("no-location");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const found = await resolveCheckinLocationsAction(latitude, longitude, accuracy);
        if (found.length === 0) {
          setLocationError("Please try again when you are inside the church.");
          setStep("no-location");
        } else if (found.length === 1) {
          await proceedToConfirm(found[0]);
        } else {
          setCandidates(found);
          setStep("pick-location");
        }
      },
      () => {
        setLocationError(
          "We need your location to confirm you're at the church. Please allow location access and try again."
        );
        setStep("no-location");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // Reads localStorage once on mount -- deferred into a microtask (rather
  // than called synchronously in the effect body) so the setState calls
  // never run directly within the effect itself. Starting from a neutral
  // "loading" step also avoids a server/client hydration mismatch, since
  // the server has no localStorage to read at all.
  useEffect(() => {
    Promise.resolve().then(() => {
      let stored: StoredIdentity | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        stored = parsed?.id && parsed?.name ? parsed : null;
      } catch {
        stored = null;
      }
      if (stored) {
        setIdentity(stored);
        setStep("locating");
      } else {
        setStep("setup");
      }
    });
  }, []);

  useEffect(() => {
    if (step !== "locating") return;
    Promise.resolve().then(() => locate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSearching(true);
    const results = await searchDeaconsByNameAction(firstName.trim(), lastName.trim());
    setMatches(results);
    setSearched(true);
    setSearching(false);
  }

  function pickIdentity(m: NameMatch) {
    const stored: StoredIdentity = { id: m.id, name: `${m.firstName} ${m.lastName}` };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setIdentity(stored);
    setStep("locating");
  }

  function switchIdentity() {
    localStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
    setFirstName("");
    setLastName("");
    setMatches([]);
    setSearched(false);
    setStep("setup");
  }

  async function handleConfirm() {
    if (!identity || !location) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitQuickCheckinAction(identity.id, location.locationId, serviceType);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Couldn't check in — please try again.");
      return;
    }
    setStep("done");
  }

  const weekday = date ? weekdayLabel(date) : "";
  const summaryLabel = [weekday, isSpecialFeast && feastName ? feastName : null, SERVICE_LABELS[serviceType]]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Quick Check-in</h1>

      {step === "loading" && <p className="muted">Loading…</p>}

      {step === "setup" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            First time here — enter your name so we know who you are. We&apos;ll remember it on this phone from
            now on.
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

          {searched && (
            <div style={{ marginTop: "1rem" }}>
              {matches.length === 0 ? (
                <p className="muted">
                  We couldn&apos;t find your name on the roster. Please add your profile first at{" "}
                  <a href="/update-profile">Update Your Profile</a>, then come back here.
                </p>
              ) : (
                <>
                  <p className="muted" style={{ marginBottom: "0.6rem" }}>
                    Is one of these you?
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="btn btn-secondary"
                        style={{ justifyContent: "flex-start" }}
                        onClick={() => pickIdentity(m)}
                      >
                        {m.firstName} {m.lastName}
                        {m.nameQualifier && ` (${m.nameQualifier})`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(step === "locating" || step === "pick-location") && identity && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Hi {identity.name.split(" ")[0]} — checking your location…
          </p>
          {step === "locating" && <p className="muted">Locating…</p>}
          {step === "pick-location" && (
            <>
              <p className="muted" style={{ marginBottom: "0.6rem" }}>
                You&apos;re close to more than one church — which one are you at?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {candidates.map((c) => (
                  <button
                    key={c.locationId}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => proceedToConfirm(c)}
                  >
                    {c.locationName}
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }} onClick={switchIdentity}>
            Not {identity.name.split(" ")[0]}?
          </button>
        </div>
      )}

      {step === "no-location" && (
        <div className="card">
          <p className="error-text" style={{ marginBottom: "1rem" }}>
            {locationError}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="button" className="btn btn-primary" onClick={() => setStep("locating")}>
              Try again
            </button>
            {identity && (
              <button type="button" className="btn btn-secondary" onClick={switchIdentity}>
                Not {identity.name.split(" ")[0]}?
              </button>
            )}
          </div>
        </div>
      )}

      {step === "confirm" && identity && location && (
        <div className="card">
          {submitError && <p className="error-text" style={{ marginBottom: "1rem" }}>{submitError}</p>}
          <p style={{ fontSize: "1.05rem", marginBottom: "1.25rem" }}>
            Checking <strong>{identity.name}</strong> into <strong>{location.locationName}</strong> —{" "}
            <strong>{summaryLabel}</strong>. Confirm?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.25rem" }}>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleConfirm}>
              {submitting ? "Checking in…" : "Confirm check-in"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Something not right? Change it:
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={switchIdentity}>
              Name
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => (candidates.length > 1 ? setStep("pick-location") : setStep("locating"))}
            >
              Location
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setServiceType((s) => (s === "S1" ? "S2" : "S1"))}
            >
              Service ({serviceType === "S1" ? "switch to 2nd" : "switch to 1st"})
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>You&apos;re checked in!</h3>
          <p className="muted">You can close this page now.</p>
        </div>
      )}
    </div>
  );
}
