"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WindowSettings } from "@/lib/repo/liturgySchedule";
import { setCheckinWindowSettingsAction } from "@/lib/actions/schedule";
import InfoHeading from "./InfoHeading";

/** How long before a liturgy's start check-in opens, and how long after it starts it closes -- one setting for every church and liturgy. */
export default function CheckinWindowSettingsCard({ settings }: { settings: WindowSettings }) {
  const router = useRouter();
  const [openBefore, setOpenBefore] = useState(String(settings.openBefore));
  const [closeAfter, setCloseAfter] = useState(String(settings.closeAfter));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openN = Number(openBefore);
  const closeN = Number(closeAfter);
  const valid = Number.isInteger(openN) && Number.isInteger(closeN) && openBefore !== "" && closeAfter !== "";

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await setCheckinWindowSettingsAction(openN, closeN);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card roomy">
      <InfoHeading title="Check-in window timing">
        <p className="muted" style={{ marginBottom: "1rem" }}>
          When check-in opens and closes, relative to each liturgy&apos;s start time. This applies to every church and
          every liturgy, including extras. A liturgy also closes as soon as the next one&apos;s window opens, so only one
          is ever open at a time.
        </p>
      </InfoHeading>
      <div className="fieldrow fieldrow-pair" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label>Opens</label>
          <input
            type="number"
            min={0}
            max={240}
            inputMode="numeric"
            value={openBefore}
            onChange={(e) => { setOpenBefore(e.target.value); setSaved(false); }}
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>minutes before the start</span>
        </div>
        <div className="field">
          <label>Closes</label>
          <input
            type="number"
            min={30}
            max={720}
            inputMode="numeric"
            value={closeAfter}
            onChange={(e) => { setCloseAfter(e.target.value); setSaved(false); }}
          />
          <span className="muted" style={{ fontSize: "0.8rem" }}>minutes after the start</span>
        </div>
      </div>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {saved && <p style={{ marginBottom: "0.75rem", color: "var(--green)" }}>Saved.</p>}
      <button className="btn btn-primary" disabled={saving || !valid} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
