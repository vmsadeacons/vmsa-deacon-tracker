"use client";

import { useEffect, useState } from "react";
import type { NameMatch } from "@/lib/repo/publicProfile";
import type { CheckinLocationOption, GpsFix } from "@/lib/repo/quickCheckin";
import type { OpenLiturgyInfo } from "@/lib/repo/liturgySchedule";
import { SERVICE_LABELS } from "@/lib/constants";
import { weekdayLabel } from "@/lib/timezone";
import { formatTime12 } from "@/lib/formatTime";
import {
  searchDeaconsByNameAction,
  resolveQrTokenAction,
  getCheckinOpenLiturgyAction,
  submitQrCheckinAction,
} from "@/app/quick-checkin/actions";

// Same key as Agios Check-in, so a deacon who has already picked their name
// there (in the same browser) isn't asked again.
const STORAGE_KEY = "quickCheckinDeacon";

interface StoredIdentity {
  id: string;
  name: string;
}

type Step = "loading" | "setup" | "preparing" | "confirm" | "done" | "invalid";

/** One try at the phone's position; never blocks the check-in -- a missing position just gets the check-in flagged. */
function getFix(): Promise<GpsFix | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyMeters: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

/** What a church's QR code opens: the church comes from the code, the liturgy from whatever is open right now. */
export default function QrCheckinClient() {
  const [step, setStep] = useState<Step>("loading");
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [token, setToken] = useState("");
  const [church, setChurch] = useState<CheckinLocationOption | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [liturgy, setLiturgy] = useState<OpenLiturgyInfo | null>(null);
  const [checkingAgain, setCheckingAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("");
  const [doneFlagged, setDoneFlagged] = useState(false);

  // Name search (first scan on this browser only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [searched, setSearched] = useState(false);

  // Reads the code from the address and the saved name from this browser
  // once -- deferred into a microtask so the setState calls never run
  // directly in the effect body, and so the server render (which has neither)
  // matches the first client render.
  useEffect(() => {
    Promise.resolve().then(() => {
      const t = new URLSearchParams(window.location.search).get("c") ?? "";
      setToken(t);
      if (!t) {
        setStep("invalid");
        return;
      }
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
        setStep("preparing");
      } else {
        setStep("setup");
      }
    });
  }, []);

  // Works out the church (from the code) and the position (from the phone) side by side.
  useEffect(() => {
    if (step !== "preparing") return;
    let cancelled = false;
    (async () => {
      const [found, position] = await Promise.all([resolveQrTokenAction(token), getFix()]);
      if (cancelled) return;
      if (!found) {
        setStep("invalid");
        return;
      }
      const open = await getCheckinOpenLiturgyAction(found.id);
      if (cancelled) return;
      setChurch(found);
      setFix(position);
      setLiturgy(open);
      setSubmitError(null);
      setStep("confirm");
    })();
    return () => {
      cancelled = true;
    };
  }, [step, token]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSearching(true);
    setMatches(await searchDeaconsByNameAction(firstName.trim(), lastName.trim()));
    setSearched(true);
    setSearching(false);
  }

  function pickIdentity(m: NameMatch) {
    const stored: StoredIdentity = { id: m.id, name: `${m.firstName} ${m.lastName}` };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private browsing etc.: they'll just be asked again next time.
    }
    setIdentity(stored);
    setStep("preparing");
  }

  function changeName() {
    setFirstName("");
    setLastName("");
    setMatches([]);
    setSearched(false);
    setStep("setup");
  }

  async function recheckLiturgy() {
    if (!church) return;
    setCheckingAgain(true);
    setLiturgy(await getCheckinOpenLiturgyAction(church.id));
    setCheckingAgain(false);
  }

  async function handleConfirm() {
    if (!identity) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitQrCheckinAction(token, identity.id, fix);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Couldn't check in — please try again.");
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
      <h1>Check-in</h1>

      {step === "loading" && <p className="muted">Loading…</p>}

      {step === "invalid" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="error-text" style={{ fontSize: "1.4rem", lineHeight: 1.4 }}>
            This QR code isn&apos;t valid any more.
          </p>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Please scan the code posted at the church, or use Agios Check-in.
          </p>
        </div>
      )}

      {step === "setup" && (
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            First time here — enter your name so we know who you are. We&apos;ll remember it in this browser from now on.
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

      {step === "preparing" && identity && (
        <div className="card">
          <p className="muted">Hi {identity.name.split(" ")[0]} — getting things ready…</p>
        </div>
      )}

      {step === "confirm" && identity && church && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
            {submitError && <p className="error-text" style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>{submitError}</p>}
            {open ? (
              <>
                <p style={{ fontSize: "1.7rem", lineHeight: 1.35 }}>
                  Checking <strong>{identity.name}</strong> into <strong>{church.name}</strong>
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
                  No liturgy is open for check-in at <strong>{church.name}</strong> right now
                </p>
                {liturgy?.next && (
                  <p style={{ fontSize: "1.2rem", color: "var(--wine)", marginTop: "0.6rem" }}>
                    {SERVICE_LABELS[liturgy.next.serviceType]} opens at {formatTime12(liturgy.next.opensAt)}
                    {liturgy.next.opensTomorrow ? " tomorrow" : ""}
                  </p>
                )}
              </>
            )}
            {!fix && (
              <p className="muted" style={{ fontSize: "0.9rem", marginTop: "0.9rem", textWrap: "balance" }}>
                We couldn&apos;t get your location. You can still check in, but an admin will take a look at it.
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

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "1.1rem", padding: "0.9rem" }}
              onClick={changeName}
            >
              Not {identity.name.split(" ")[0]}? Change name
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
            {doneLabel && church && (
              <p style={{ fontSize: "1.2rem", marginTop: "0.6rem" }}>
                {church.name} · {doneLabel}
              </p>
            )}
            {doneFlagged && (
              <p className="muted" style={{ fontSize: "1rem", marginTop: "0.75rem", textWrap: "balance" }}>
                We couldn&apos;t confirm your location, so an admin will take a quick look at this check-in.
              </p>
            )}
            <p className="muted" style={{ fontSize: "1.3rem", marginTop: "0.75rem" }}>
              You can close this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
