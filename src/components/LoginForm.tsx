"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import CopticCross from "./CopticCross";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  "no-account":
    "No account exists for this email, or it's not active — ask a System Admin to grant you access, or sign in with email + PIN below.",
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
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
          <CopticCross size={48} />
          <h1 style={{ margin: 0 }}>VMSA Deacon Tracker</h1>
        </div>
        <div className="card">
          <p className="muted" style={{ marginBottom: "1rem", textAlign: "center" }}>
            Sign in to continue
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

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span className="muted" style={{ fontSize: "0.78rem" }}>or sign in with email + PIN</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

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
            <button className="btn btn-secondary" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
