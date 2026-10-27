"use client";

import { useEffect, useState } from "react";
import type { NameMatch } from "@/lib/repo/publicProfile";
import type { CheckinLocationMatch, CheckinLocationOption, GpsFix } from "@/lib/repo/quickCheckin";
import type { OpenLiturgyInfo } from "@/lib/repo/liturgySchedule";
import { SERVICE_LABELS } from "@/lib/constants";
import { weekdayLabel } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";
import {
  searchDeaconsByNameAction,
  resolveCheckinLocationsAction,
  listActiveLocationsForCheckinAction,
  getCheckinOpenLiturgyAction,
  submitQuickCheckinAction,
} from "@/app/quick-checkin/actions";

const STORAGE_KEY = "quickCheckinDeacon";

// How long a detected location is trusted before the app insists on
// re-checking it -- see the foreground-resume effect below.
const STALE_LOCATION_MS = 90_000;

function timeAgoLabel(sinceMs: number): string {
  const seconds = Math.floor((Date.now() - sinceMs) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

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
  // The phone's last reported position (null when it couldn't give one). It's
  // sent with the check-in so the server can verify the deacon is at the
  // church they chose -- a check-in it can't verify is recorded but flagged.
  const [fix, setFix] = useState<GpsFix | null>(null);

  // Manual location override -- geolocation (automatic or ambiguous-among-
  // candidates) is a convenience, never the only way to pick a church.
  const [allLocations, setAllLocations] = useState<CheckinLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [manualLocationId, setManualLocationId] = useState("");

  // The one liturgy currently open for check-in at the chosen church (the
  // deacon never picks a liturgy -- the schedule decides), or none.
  const [liturgy, setLiturgy] = useState<OpenLiturgyInfo | null>(null);
  const [checkingAgain, setCheckingAgain] = useState(false);
  const [doneLabel, setDoneLabel] = useState("");
  const [doneFlagged, setDoneFlagged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // When the confirmed location was last (re-)resolved, and how -- "detected"
  // for GPS (including picking among ambiguous GPS candidates), "selected"
  // for a manual override (the dropdown, or "Change Church"). Drives both
  // the foreground-resume staleness check and the confirm screen's note.
  const [locationResolvedAt, setLocationResolvedAt] = useState<{ at: number; source: "detected" | "selected" } | null>(
    null
  );
  // When locate() last finished WITHOUT resolving a location (no nearby
  // church, geolocation denied/unsupported) -- shown on the no-location
  // screen so it's clear how fresh (or stale) that "no" answer is.
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  // "Change Name" on the confirm screen goes straight to the search screen
  // (no separate "are you sure" step), but doesn't touch the stored
  // identity yet -- only actually picking a new match does that (see
  // pickIdentity) -- so "Go back" on the search screen can just return to
  // the confirm screen with everything untouched.
  const [nameChangeFromConfirm, setNameChangeFromConfirm] = useState(false);

  async function ensureLocationsLoaded() {
    if (allLocations.length > 0) return;
    setLoadingLocations(true);
    const locs = await listActiveLocationsForCheckinAction();
    setAllLocations(locs);
    setLoadingLocations(false);
  }

  async function proceedToConfirm(loc: CheckinLocationMatch, source: "detected" | "selected") {
    setLocation(loc);
    const [open] = await Promise.all([getCheckinOpenLiturgyAction(loc.locationId), ensureLocationsLoaded()]);
    setLiturgy(open);
    setSubmitError(null);
    setLocationResolvedAt({ at: Date.now(), source });
    setStep("confirm");
  }

  async function locate() {
    setLocationError(null);
    setCandidates([]);
    setFix(null);
    if (!navigator.geolocation) {
      setLocationError("This device doesn't support location detection, so we can't confirm you're at the church.");
      setLastCheckedAt(Date.now());
      setStep("no-location");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setFix({ lat: latitude, lng: longitude, accuracyMeters: accuracy });
        const found = await resolveCheckinLocationsAction(latitude, longitude, accuracy);
        if (found.length === 0) {
          setLocationError("No church was detected near you!");
          setLastCheckedAt(Date.now());
          setStep("no-location");
        } else if (found.length === 1) {
          await proceedToConfirm(found[0], "detected");
        } else {
          setCandidates(found);
          setStep("pick-location");
        }
      },
      () => {
        setLocationError(
          "We need your location to confirm you're at the church. Please allow location access and try again."
        );
        setLastCheckedAt(Date.now());
        setStep("no-location");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // Which screen the manual picker was opened from, so its "Go back" button
  // can return there (the no-location screen, or the ambiguous-candidates one).
  const [manualReturnStep, setManualReturnStep] = useState<Step>("no-location");

  async function openManualLocationPicker() {
    setManualReturnStep(step === "pick-location" ? "pick-location" : "no-location");
    setManualLocationId(location?.locationId ?? "");
    setStep("manual-location");
    await ensureLocationsLoaded();
  }

  function confirmManualLocation() {
    const loc = allLocations.find((l) => l.id === manualLocationId);
    if (!loc) return;
    void proceedToConfirm({ locationId: loc.id, locationName: loc.name }, "selected");
  }

  /** The confirm screen's "Change Church" dropdown -- picks and re-confirms in one step, no separate screen. */
  function handleChangeChurch(locationId: string) {
    const loc = allLocations.find((l) => l.id === locationId);
    if (!loc) return;
    void proceedToConfirm({ locationId: loc.id, locationName: loc.name }, "selected");
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

  // The app can't close itself (see the "done" step) -- it just sits
  // backgrounded until swiped away or brought back, with its React state
  // (including the last detected location) frozen exactly as it was. This
  // re-checks location the moment the app is actually brought back to the
  // foreground, but only if it's been sitting for a while -- a brief
  // app-switch (e.g. to check a text) shouldn't cause a flicker.
  useEffect(() => {
    function handleForeground() {
      const stale = locationResolvedAt === null || Date.now() - locationResolvedAt.at > STALE_LOCATION_MS;
      if ((step === "confirm" || step === "pick-location") && stale) {
        Promise.resolve().then(() => setStep("locating"));
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") handleForeground();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    // pageshow is a second signal for the same "we're back" moment -- some
    // iOS Safari versions have been unreliable about firing
    // visibilitychange alone when resuming a fully-suspended PWA.
    window.addEventListener("pageshow", handleForeground);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handleForeground);
    };
  }, [step, locationResolvedAt]);

  // Keeps the "Detected/Selected X ago" and "Last checked X ago" notes
  // advancing even if nothing else causes a re-render -- the labels
  // themselves always compute off the real clock (timeAgoLabel), this timer
  // just forces React to recompute them.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (step !== "confirm" && step !== "no-location") return;
    const id = setInterval(() => forceTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
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
    setNameChangeFromConfirm(false);
    setStep("locating");
  }

  function switchIdentity() {
    localStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
    setFirstName("");
    setLastName("");
    setMatches([]);
    setSearched(false);
    setNameChangeFromConfirm(false);
    setStep("setup");
  }

  /** Confirm screen's "Change Name" -- straight to the search screen, identity untouched until a match is actually picked. */
  function startNameChangeFromConfirm() {
    setFirstName("");
    setLastName("");
    setMatches([]);
    setSearched(false);
    setNameChangeFromConfirm(true);
    setStep("setup");
  }

  /** Search screen's "Go back" -- only shown when it was reached via startNameChangeFromConfirm; identity/location were never touched. */
  function cancelNameChange() {
    setNameChangeFromConfirm(false);
    setFirstName("");
    setLastName("");
    setMatches([]);
    setSearched(false);
    setStep("confirm");
  }

  /** Re-asks the server which liturgy is open (no GPS re-check) -- for the "nothing open" screen and after a rejected check-in. */
  async function recheckLiturgy() {
    if (!location) return;
    setCheckingAgain(true);
    setLiturgy(await getCheckinOpenLiturgyAction(location.locationId));
    setCheckingAgain(false);
  }

  async function handleConfirm() {
    if (!identity || !location) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitQuickCheckinAction(
      identity.id,
      location.locationId,
      locationResolvedAt?.source ?? "detected",
      fix
    );
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Couldn't check in — please try again.");
      // The window may have just closed (or a different liturgy opened) --
      // refresh so the screen reflects what's actually open now.
      void recheckLiturgy();
      return;
    }
    setDoneLabel(result.label);
    setDoneFlagged(result.flagged);
    setStep("done");
  }

  const open = liturgy?.open ?? null;
  const summaryLabel = open
    ? [
        liturgy ? weekdayLabel(liturgy.date) : "",
        open.isSpecialFeast && open.feastName ? open.feastName : null,
        SERVICE_LABELS[open.serviceType],
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Agios Check-in</h1>

      {step === "loading" && <p className="muted">Loading…</p>}

      {step === "setup" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            {nameChangeFromConfirm
              ? "Search for your name again."
              : "First time here — enter your name so we know who you are. We'll remember it on this phone from now on."}
          </p>
          {nameChangeFromConfirm && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: "1rem" }}
              onClick={cancelNameChange}
            >
              ← Go back
            </button>
          )}
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
                    onClick={() => proceedToConfirm(c, "detected")}
                  >
                    {c.locationName}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStep("locating")}>
                  Refresh location
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={openManualLocationPicker}>
                  None of these — choose manually
                </button>
              </div>
            </>
          )}
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }} onClick={switchIdentity}>
            Not {identity.name.split(" ")[0]}?
          </button>
        </div>
      )}

      {step === "no-location" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <svg
              width="72"
              height="72"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Warning"
              style={{ marginBottom: "0.75rem" }}
            >
              <path
                d="M12 2.6 22.4 20.6H1.6L12 2.6Z"
                fill="#f5b800"
                stroke="#c98f00"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <rect x="11" y="9" width="2" height="6.2" rx="1" fill="#4a3300" />
              <circle cx="12" cy="17.6" r="1.15" fill="#4a3300" />
            </svg>
            <p className="error-text" style={{ fontSize: "1.7rem", lineHeight: 1.4, textWrap: "balance" }}>
              {locationError}
            </p>
            {lastCheckedAt && (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Last checked {timeAgoLabel(lastCheckedAt)}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "1.25rem", padding: "1.1rem" }}
              onClick={() => setStep("locating")}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "1.25rem", padding: "1.1rem" }}
              onClick={openManualLocationPicker}
            >
              Choose Church manually
            </button>
            {identity && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "1.25rem", padding: "1.1rem" }}
                onClick={switchIdentity}
              >
                Not {identity.name.split(" ")[0]}?
              </button>
            )}
          </div>
        </div>
      )}

      {step === "manual-location" && identity && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <p style={{ fontSize: "1.7rem", lineHeight: 1.4 }}>Choose the church you&apos;re attending now</p>
          </div>
          {loadingLocations ? (
            <p className="muted" style={{ textAlign: "center", fontSize: "1.2rem" }}>
              Loading…
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <select
                value={manualLocationId}
                onChange={(e) => setManualLocationId(e.target.value)}
                style={{ width: "100%", fontSize: "1.25rem", padding: "1.1rem" }}
              >
                <option value="">Select a church</option>
                {allLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: "1.25rem", padding: "1.1rem" }}
                disabled={!manualLocationId}
                onClick={confirmManualLocation}
              >
                Continue
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "1.25rem", padding: "1.1rem", marginTop: "0.85rem" }}
            onClick={() => setStep(manualReturnStep)}
          >
            Go back
          </button>
        </div>
      )}

      {step === "confirm" && identity && location && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "75vh" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            {submitError && <p className="error-text" style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>{submitError}</p>}
            {open ? (
              <>
                <p style={{ fontSize: "1.7rem", lineHeight: 1.35 }}>
                  Checking <strong>{identity.name}</strong> into <strong>{location.locationName}</strong>
                </p>
                <p style={{ fontSize: "1.3rem", color: "var(--wine)", marginTop: "0.6rem" }}>{summaryLabel}</p>
                <p className="muted" style={{ fontSize: "0.95rem", marginTop: "0.3rem" }}>
                  Starts {formatTime12(open.startTime)}
                  {open.startsEveningBefore ? " the evening before" : ""}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "1.7rem", lineHeight: 1.35 }}>
                  No liturgy is open for check-in at <strong>{location.locationName}</strong> right now
                </p>
                {liturgy?.next && (
                  <p style={{ fontSize: "1.2rem", color: "var(--wine)", marginTop: "0.6rem" }}>
                    {SERVICE_LABELS[liturgy.next.serviceType]} opens at {formatTime12(liturgy.next.opensAt)}
                    {liturgy.next.opensTomorrow ? " tomorrow" : ""}
                  </p>
                )}
              </>
            )}
            {locationResolvedAt && (
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                {locationResolvedAt.source === "selected" ? "Location selected" : "Detected"}{" "}
                {timeAgoLabel(locationResolvedAt.at)}
              </p>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {open ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={handleConfirm}
                style={{ fontSize: "1.35rem", padding: "1.1rem 3rem" }}
              >
                {submitting ? "Checking in…" : "Confirm check-in"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={checkingAgain}
                onClick={recheckLiturgy}
                style={{ fontSize: "1.35rem", padding: "1.1rem 3rem" }}
              >
                {checkingAgain ? "Checking…" : "Check again"}
              </button>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.85rem" }}>
            <p className="muted" style={{ textAlign: "center", fontSize: "0.95rem", marginBottom: "0.15rem" }}>
              Something not right? Change it:
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "1.1rem", padding: "0.9rem" }}
              onClick={startNameChangeFromConfirm}
            >
              Change Name
            </button>
            {/*
              A plain <select> renders its closed-box text left-aligned on
              most platforms no matter what text-align CSS says (a
              native-control quirk, not something this app's CSS controls)
              -- so the visible "button" here is an ordinary centered div
              matching the other two exactly, with a fully transparent
              <select> stacked on top of it to capture the tap/click and
              open the real (still native, still accessible) picker.
            */}
            <div style={{ position: "relative", width: "100%" }}>
              <div
                className="btn btn-secondary"
                style={{ fontSize: "1.1rem", padding: "0.9rem", width: "100%" }}
                aria-hidden="true"
              >
                {loadingLocations ? "Loading churches…" : "Change Church"}
              </div>
              <select
                aria-label="Change Church"
                value=""
                disabled={loadingLocations}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) handleChangeChurch(id);
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
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
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "1.1rem", padding: "0.9rem" }}
              onClick={() => setStep("locating")}
            >
              Refresh Location
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: "2rem", margin: 0 }}>You&apos;re checked in!</h3>
            {doneLabel && location && (
              <p style={{ fontSize: "1.2rem", marginTop: "0.6rem" }}>
                {location.locationName} · {doneLabel}
              </p>
            )}
            {doneFlagged && (
              <p className="muted" style={{ fontSize: "1rem", marginTop: "0.75rem", textWrap: "balance" }}>
                We couldn&apos;t confirm your location, so an admin will take a quick look at this check-in.
              </p>
            )}
            <p className="muted" style={{ fontSize: "1.3rem", marginTop: "0.75rem" }}>
              Close by swiping the app away.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
