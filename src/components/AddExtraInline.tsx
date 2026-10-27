"use client";

import { useState } from "react";
import type { ServiceTypeCode } from "@/lib/constants";
import { addExtraLiturgyAction } from "@/lib/actions/schedule";

/**
 * "+ Add another liturgy" for one church and date. An extra always gets its
 * own start time (it can differ from day to day), and can be marked as
 * starting the evening before -- a midnight liturgy that counts for the day.
 */
export default function AddExtraInline({
  locationId,
  date,
  label = "+ Add another liturgy",
  disabled,
  onAdded,
}: {
  locationId: string;
  date: string;
  label?: string;
  disabled?: boolean;
  onAdded: (serviceType: ServiceTypeCode) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [eveningBefore, setEveningBefore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!startTime) {
      setError("Enter the time the liturgy starts");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await addExtraLiturgyAction(locationId, date, startTime, eveningBefore);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setStartTime("");
    setEveningBefore(false);
    await onAdded(res.serviceType);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ alignSelf: "flex-start" }}
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.75rem",
        marginTop: "0.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        maxWidth: 340,
      }}
    >
      <div className="field">
        <label>Start time</label>
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem", fontSize: "0.9rem" }}>
        <input
          type="checkbox"
          style={{ marginTop: "0.2rem" }}
          checked={eveningBefore}
          onChange={(e) => setEveningBefore(e.target.checked)}
        />
        <span>
          Starts the evening before (a midnight liturgy that counts for this day)
        </span>
      </label>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={handleAdd}>
          {busy ? "Adding…" : "Add"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
