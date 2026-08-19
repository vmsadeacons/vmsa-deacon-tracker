"use client";

import { useState } from "react";

/**
 * Admin-only (Record a Liturgy) -- Check-in and Reports never render this.
 * The caller should remount this component (e.g. via a `key` tied to
 * date/location/service) whenever the selected liturgy changes, so its
 * local draft state resets to match the newly-selected liturgy instead of
 * needing an effect to sync it.
 */
export default function SpecialFeastControl({
  isSpecialFeast,
  feastName,
  onSave,
}: {
  isSpecialFeast: boolean;
  feastName: string | null;
  onSave: (isSpecialFeast: boolean, feastName: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [checked, setChecked] = useState(isSpecialFeast);
  const [draft, setDraft] = useState(feastName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCheckboxChange(next: boolean) {
    setChecked(next);
    setError(null);
    if (!next) {
      setSaving(true);
      const result = await onSave(false, null);
      if (!result.ok) setError(result.error ?? "Couldn't update");
      setSaving(false);
    }
  }

  async function handleSaveName() {
    setSaving(true);
    setError(null);
    const result = await onSave(true, draft.trim());
    if (!result.ok) setError(result.error ?? "Couldn't update");
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
            <input
              placeholder="Feast name (e.g. Nativity)"
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              // .field input is width: 100% globally (so a normal single
              // input fills its field) -- override it here since this
              // input shares a row with the checkbox and Save button.
              style={{ width: "auto", flex: "1 1 220px" }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving || !draft.trim() || draft.trim() === feastName}
              onClick={handleSaveName}
            >
              Save
            </button>
          </>
        )}
      </div>
      {error && <p className="error-text" style={{ marginTop: "0.4rem" }}>{error}</p>}
    </div>
  );
}
