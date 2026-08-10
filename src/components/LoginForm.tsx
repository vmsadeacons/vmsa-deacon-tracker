"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import CopticCross from "./CopticCross";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  "no-admin-account":
    "No admin account exists for this email — ask the System Admin to grant you access.",
  "deacon-google":
    "This account is not set up for Google sign-in — deacons sign in with email + PIN.",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setSubmitting(true);
    const result = await signIn("deacon-pin", { email, pin, redirect: false });
    setSubmitting(false);
    if (result?.error) {
      setPinError("Invalid email or PIN, or this account is not active.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
          <CopticCross size={48} />
          <h1 style={{ margin: 0 }}>VMSA Deacon Tracker</h1>
        </div>
        <div className="grid-2">
          <div className="card">
            <h2>Administrators</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Sign in with your church Google account.
            </p>
            {googleError && (
              <p className="error-text" style={{ marginBottom: "1rem" }}>
                {GOOGLE_ERROR_MESSAGES[googleError] ?? "Sign-in failed. Please try again."}
              </p>
            )}
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => signIn("google", { callbackUrl: "/" })}
            >
              Continue with Google
            </button>
          </div>

          <div className="card">
            <h2>Deacons</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Sign in with your email and PIN.
            </p>
            <form onSubmit={handlePinSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pin">PIN</label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              {pinError && <p className="error-text">{pinError}</p>}
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
