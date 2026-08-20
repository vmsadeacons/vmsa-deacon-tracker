"use client";

import { useState } from "react";
import type { FeastNameRow } from "@/lib/repo/feastNames";

// `checked`/`draftId` are derived from props on every render rather than
// mirrored into local state at mount time -- date/location/service changes
// are async, so a local copy would show the *previous* selection's feast
// status until the fresh liturgy context arrived (a real bug hit during
// testing). `pendingCheck` (checkbox ticked but not yet saved) and
// `touched`/`manualDraftId` (dropdown changed but not yet saved) are the
// only local state, tracking unsaved intent; the caller remounts this
// component via a `key` on date/location/service so they reset naturally.
export default function SpecialFeastControl({
  isSpecialFeast,
  feastNameId,
  feastNames,
  onSave,
}: {
  isSpecialFeast: boolean;
  feastNameId: string | null;
  feastNames: FeastNameRow[];
  onSave: (isSpecialFeast: boolean, feastNameId: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pendingCheck, setPendingCheck] = useState(false);
  const [touched, setTouched] = useState(false);
  const [manualDraftId, setManualDraftId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checked = isSpecialFeast || pendingCheck;
  const draftId = touched ? manualDraftId : feastNameId ?? "";

  async function handleCheckboxChange(next: boolean) {
    setError(null);
    if (next) {
      setPendingCheck(true);
    } else {
      setPendingCheck(false);
      setTouched(false);
      setSaving(true);
      const result = await onSave(false, null);
      if (!result.ok) setError(result.error ?? "Couldn't update");
      setSaving(false);
    }
  }

  async function handleSaveName() {
    setSaving(true);
    setError(null);
    const result = await onSave(true, draftId);
    if (result.ok) {
      setPendingCheck(false);
      setTouched(false);
    } else {
      setError(result.error ?? "Couldn't update");
    }
    setSaving(false);
  }

  return (
    <div className="field">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={checked}
            disabled={saving}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
          />
          Special Feast
        </label>
        {checked && (
          <>
            <select
              value={draftId}
              disabled={saving}
              onChange={(e) => {
                setTouched(true);
                setManualDraftId(e.target.value);
              }}
              style={{ width: "auto", flex: "1 1 220px" }}
            >
              <option value="" disabled hidden>
                — select feast —
              </option>
              {feastNames.map((f) => (
                <option key={f.id} value={f.id} disabled={f.status !== "Active"}>
                  {f.name}
                  {f.status !== "Active" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving || !draftId || draftId === feastNameId}
              onClick={handleSaveName}
            >
              Save
            </button>
          </>
        )}
      </div>
      {checked && feastNames.length === 0 && (
        <p className="muted" style={{ marginTop: "0.4rem" }}>
          No feast names configured yet — add one in Settings → Feast Names.
        </p>
      )}
      {error && <p className="error-text" style={{ marginTop: "0.4rem" }}>{error}</p>}
    </div>
  );
}
