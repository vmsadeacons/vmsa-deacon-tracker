"use client";

import { useState } from "react";

/**
 * Admin-only (Record a Liturgy) -- Check-in and Reports never render this.
 *
 * Both the checkbox and the name field are derived directly off props
 * (isSpecialFeast/feastName), not copied into local state at mount: since
 * selecting a different date/location/service is async (the fresh liturgy
 * data arrives after the field change itself), a local copy seeded at
 * mount would show the *previous* liturgy's feast status/name until the
 * next remount -- sometimes indefinitely, if the fetch resolves after the
 * component already mounted with stale props. Deriving instead means the
 * display self-corrects the instant the real data lands, no matter the
 * timing. `pendingCheck` and `touched`/`manualDraft` exist only to hold the
 * admin's in-progress, unsaved input; they carry no server truth of their
 * own and are discarded (not merged) on the next liturgy switch.
 *
 * The caller should remount this component (e.g. via a `key` tied to
 * date/location/service) whenever the selected liturgy changes, so that
 * in-progress input doesn't leak from one liturgy to another.
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
  const [pendingCheck, setPendingCheck] = useState(false);
  const [touched, setTouched] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checked = isSpecialFeast || pendingCheck;
  const draft = touched ? manualDraft : feastName ?? "";

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
    const result = await onSave(true, draft.trim());
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
            <input
              placeholder="Feast name (e.g. Nativity)"
              value={draft}
              disabled={saving}
              onChange={(e) => {
                setTouched(true);
                setManualDraft(e.target.value);
              }}
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
