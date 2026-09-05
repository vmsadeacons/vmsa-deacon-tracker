"use client";

import { useEffect, useState } from "react";
import type { NameMatch } from "@/lib/repo/publicProfile";
import type { CheckinLocationMatch, CheckinLocationOption } from "@/lib/repo/quickCheckin";
import type { ServiceTypeCode } from "@/lib/constants";
import { SERVICE_LABELS } from "@/lib/constants";
import { weekdayLabel } from "@/lib/timezone";
import {
  searchDeaconsByNameAction,
  resolveCheckinLocationsAction,
  listActiveLocationsForCheckinAction,
  getCheckinPredictionAction,
  submitQuickCheckinAction,
} from "@/app/quick-checkin/actions";

const STORAGE_KEY = "quickCheckinDeacon";

interface StoredIdentity {
  id: string;
  name: string;
}

type Step =
  | "loading"
  | "setup"
  | "locating"
  | "pick-location"
  | "no-location"
  | "manual-location"
  | "confirm"
  | "done";

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

  // Manual location override -- geolocation (automatic or ambiguous-among-
  // candidates) is a convenience, never the only way to pick a church.
  const [allLocations, setAllLocations] = useState<CheckinLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [manualLocationId, setManualLocationId] = useState("");

  // Prediction / confirm
  const [date, setDate] = useState("");
  const [serviceType, setServiceType] = useState<ServiceTypeCode>("S1");
  const [isSpecialFeast, setIsSpecialFeast] = useState(false);
  const [feastName, setFeastName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // "Change Name" on the confirm screen asks first, rather than wiping the
  // stored identity immediately -- this is what shows the "Go back" option.
  const [confirmingNameChange, setConfirmingNameChange] = useState(false);

  async function ensureLocationsLoaded() {
    if (allLocations.length > 0) return;
    setLoadingLocations(true);
    const locs = await listActiveLocationsForCheckinAction();
    setAllLocations(locs);
    setLoadingLocations(false);
  }

  async function proceedToConfirm(loc: CheckinLocationMatch) {
    setLocation(loc);
    setConfirmingNameChange(false);
    const [prediction] = await Promise.all([getCheckinPredictionAction(loc.locationId), ensureLocationsLoaded()]);
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

  async function openManualLocationPicker() {
    setManualLocationId(location?.locationId ?? "");
    setStep("manual-location");
    await ensureLocationsLoaded();
  }

  function confirmManualLocation() {
    const loc = allLocations.find((l) => l.id === manualLocationId);
    if (!loc) return;
    void proceedToConfirm({ locationId: loc.id, locationName: loc.name });
  }

  /** The confirm screen's "Change Church" dropdown -- picks and re-confirms in one step, no separate screen. */
  function handleChangeChurch(locationId: string) {
    const loc = allLocations.find((l) => l.id === locationId);
    if (!loc) return;
    void proceedToConfirm({ locationId: loc.id, locationName: loc.name });
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
      <h1>Agios Check-in</h1>

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
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "0.75rem" }}
                onClick={openManualLocationPicker}
              >
                None of these — choose manually
              </button>
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
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => setStep("locating")}>
              Try again
            </button>
            <button type="button" className="btn btn-secondary" onClick={openManualLocationPicker}>
              Choose location manually
            </button>
            {identity && (
              <button type="button" className="btn btn-secondary" onClick={switchIdentity}>
                Not {identity.name.split(" ")[0]}?
              </button>
            )}
          </div>
        </div>
      )}

      {step === "manual-location" && identity && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Choose the church you&apos;re at:
          </p>
          {loadingLocations ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              <select
                value={manualLocationId}
                onChange={(e) => setManualLocationId(e.target.value)}
                style={{ width: "100%", marginBottom: "1rem" }}
              >
                <option value="">— choose a location —</option>
                {allLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!manualLocationId}
                onClick={confirmManualLocation}
              >
                Continue
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "1rem" }}
            onClick={() => setStep("locating")}
          >
            Try detecting my location again
          </button>
        </div>
      )}

      {step === "confirm" && identity && location && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "75vh" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            {submitError && <p className="error-text" style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>{submitError}</p>}
            <p style={{ fontSize: "1.7rem", lineHeight: 1.35 }}>
              Checking <strong>{identity.name}</strong> into <strong>{location.locationName}</strong>
            </p>
            <p style={{ fontSize: "1.3rem", color: "var(--wine)", marginTop: "0.6rem" }}>{summaryLabel}</p>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting}
              onClick={handleConfirm}
              style={{ fontSize: "1.35rem", padding: "1.1rem 3rem" }}
            >
              {submitting ? "Checking in…" : "Confirm check-in"}
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.85rem" }}>
            {confirmingNameChange ? (
              <>
                <p className="muted" style={{ textAlign: "center", fontSize: "0.95rem", marginBottom: "0.15rem" }}>
                  Change your name? You&apos;ll need to search for yourself again.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "1.1rem", padding: "0.9rem" }}
                  onClick={switchIdentity}
                >
                  Yes, change name
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "1.1rem", padding: "0.9rem" }}
                  onClick={() => setConfirmingNameChange(false)}
                >
                  Go back
                </button>
              </>
            ) : (
              <>
                <p className="muted" style={{ textAlign: "center", fontSize: "0.95rem", marginBottom: "0.15rem" }}>
                  Something not right? Change it:
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "1.1rem", padding: "0.9rem" }}
                  onClick={() => setConfirmingNameChange(true)}
                >
                  Change Name
                </button>
                <select
                  className="btn btn-secondary"
                  style={{ fontSize: "1.1rem", padding: "0.9rem", textAlign: "center" }}
                  value=""
                  disabled={loadingLocations}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) handleChangeChurch(id);
                  }}
                >
                  <option value="" disabled hidden>
                    {loadingLocations ? "Loading churches…" : "Change Church"}
                  </option>
                  {allLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "1.1rem", padding: "0.9rem" }}
                  onClick={() => setServiceType((s) => (s === "S1" ? "S2" : "S1"))}
                >
                  {serviceType === "S1" ? "Switch to 2nd Liturgy" : "Switch to 1st Liturgy"}
                </button>
              </>
            )}
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
