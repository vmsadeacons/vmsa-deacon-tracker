"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { MergeCandidateDetail, MergeFieldPatch, MergeLogRow } from "@/lib/repo/mergeDeacons";
import { getMergePreviewAction, mergeDeaconsAction } from "@/app/(app)/settings/actions";
import SingleRosterPickerModal from "./SingleRosterPickerModal";

// Which record's value survives, per field. "combine" is only offered for
// fields where joining both sides makes sense (notes, preferences).
type FieldChoice = "a" | "b" | "combine";

interface FieldDef {
  key: keyof MergeCandidateDetail;
  label: string;
  display: (v: MergeCandidateDetail) => string;
  combinable?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "firstName", label: "First name", display: (d) => d.firstName },
  { key: "lastName", label: "Last name", display: (d) => d.lastName || "—" },
  { key: "nameQualifier", label: "Name qualifier", display: (d) => d.nameQualifier || "—" },
  { key: "phone", label: "Phone", display: (d) => d.phone || "—" },
  { key: "email", label: "Email", display: (d) => d.email || "—" },
  { key: "address", label: "Address", display: (d) => d.address || "—" },
  { key: "city", label: "City", display: (d) => d.city || "—" },
  { key: "dob", label: "Date of birth", display: (d) => d.dob || "—" },
  { key: "ageGroupOverride", label: "Age group override", display: (d) => d.ageGroupOverride || "—" },
  { key: "rankId", label: "Rank", display: (d) => d.rankName },
  { key: "ordinationYear", label: "Year of ordination", display: (d) => d.ordinationYear?.toString() || "—" },
  { key: "isGuest", label: "Guest", display: (d) => (d.isGuest ? "Guest" : "Not a guest") },
  { key: "status", label: "Status", display: (d) => d.status },
  {
    key: "locationPrefs",
    label: "Location preferences",
    display: (d) => (d.locationPrefs.length ? d.locationPrefs.join(", ") : "—"),
    combinable: true,
  },
  {
    key: "liturgyPrefs",
    label: "Liturgy preferences",
    display: (d) => (d.liturgyPrefs.length ? d.liturgyPrefs.join(", ") : "—"),
    combinable: true,
  },
  {
    key: "notes",
    label: "Notes",
    display: (d) => d.notes || "—",
    combinable: true,
  },
];

function differs(a: MergeCandidateDetail, b: MergeCandidateDetail, key: keyof MergeCandidateDetail): boolean {
  const av = a[key];
  const bv = b[key];
  if (Array.isArray(av) && Array.isArray(bv)) {
    return JSON.stringify([...av].sort()) !== JSON.stringify([...bv].sort());
  }
  return av !== bv;
}

function combinedText(a: string | null, b: string | null): string {
  const parts = [a?.trim(), b?.trim()].filter((v): v is string => Boolean(v));
  return parts.length ? parts.join("\n---\n") : "";
}

function combinedArray(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

function buildPatch(
  survivor: MergeCandidateDetail,
  other: MergeCandidateDetail,
  choices: Record<string, FieldChoice>,
  photoFrom: "survivor" | "merged" | null
): MergeFieldPatch {
  function pick<K extends keyof MergeCandidateDetail>(key: K): MergeCandidateDetail[K] {
    const choice = choices[key as string] ?? "a";
    return choice === "b" ? other[key] : survivor[key];
  }

  return {
    firstName: pick("firstName") as string,
    lastName: pick("lastName") as string,
    nameQualifier: pick("nameQualifier") as string | null,
    phone: pick("phone") as string | null,
    address: pick("address") as string | null,
    city: pick("city") as string | null,
    email: pick("email") as string | null,
    dob: pick("dob") as string | null,
    ageGroupOverride: pick("ageGroupOverride") as MergeCandidateDetail["ageGroupOverride"],
    rankId: pick("rankId") as string,
    ordinationYear: pick("ordinationYear") as number | null,
    isGuest: pick("isGuest") as boolean,
    status: pick("status") as "Active" | "Archived",
    locationPrefs:
      choices.locationPrefs === "combine"
        ? combinedArray(survivor.locationPrefs, other.locationPrefs)
        : (pick("locationPrefs") as string[]),
    liturgyPrefs:
      choices.liturgyPrefs === "combine"
        ? combinedArray(survivor.liturgyPrefs, other.liturgyPrefs)
        : (pick("liturgyPrefs") as string[]),
    notes:
      choices.notes === "combine"
        ? combinedText(survivor.notes, other.notes) || null
        : (pick("notes") as string | null),
    photoFrom,
  };
}

function CandidatePicker({
  label,
  items,
  selectedId,
  disabledId,
  onSelect,
}: {
  label: string;
  items: { id: string; name: string }[];
  selectedId: string | null;
  disabledId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <SingleRosterPickerModal
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        placeholder="— choose a deacon —"
        title="Choose a deacon"
        idPrefix={`merge-${label.replace(/\s+/g, "-").toLowerCase()}`}
      />
      {disabledId && selectedId === disabledId && (
        <p className="error-text" style={{ marginTop: "0.3rem" }}>
          Choose two different records.
        </p>
      )}
    </div>
  );
}

export default function MergeDeaconsCard({
  deacons,
  mergeLog,
  canEdit,
}: {
  deacons: DeaconWithAgeGroup[];
  mergeLog: MergeLogRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const items = useMemo(
    () => [...deacons].sort((a, b) => a.name.localeCompare(b.name)).map((d) => ({ id: d.id, name: d.name })),
    [deacons]
  );

  const [idA, setIdA] = useState<string | null>(null);
  const [idB, setIdB] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ a: MergeCandidateDetail; b: MergeCandidateDetail } | null>(null);
  const [survivorIsA, setSurvivorIsA] = useState(true);
  const [choices, setChoices] = useState<Record<string, FieldChoice>>({});
  const [photoFrom, setPhotoFrom] = useState<"survivor" | "merged" | null>("survivor");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  async function loadPreview(a: string, b: string) {
    setLoading(true);
    setLoadError(null);
    setPreview(null);
    const result = await getMergePreviewAction(a, b);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setPreview(result.preview);
    // Default: keep whichever record has more recorded history — the one
    // more likely to be the "real", longer-lived record.
    const aHistory = result.preview.a.participationCount + result.preview.a.passionWeekCount;
    const bHistory = result.preview.b.participationCount + result.preview.b.passionWeekCount;
    setSurvivorIsA(aHistory >= bHistory);
    setChoices({});
    setPhotoFrom(result.preview.a.hasPhoto || result.preview.b.hasPhoto ? "survivor" : null);
  }

  function selectA(id: string | null) {
    setIdA(id);
    setPreview(null);
    setMergeError(null);
    if (id && idB && id !== idB) void loadPreview(id, idB);
  }

  function selectB(id: string | null) {
    setIdB(id);
    setPreview(null);
    setMergeError(null);
    if (id && idA && id !== idA) void loadPreview(idA, id);
  }

  const survivor = preview ? (survivorIsA ? preview.a : preview.b) : null;
  const other = preview ? (survivorIsA ? preview.b : preview.a) : null;

  const bothActiveLogins = Boolean(preview?.a.linkedUserEmail && preview?.b.linkedUserEmail);

  async function handleMerge() {
    if (!survivor || !other) return;
    if (
      !confirm(
        `Merge "${other.name}" into "${survivor.name}"? "${other.name}"'s history will move to "${survivor.name}" and its record will be permanently deleted. This can't be undone.`
      )
    ) {
      return;
    }
    setMerging(true);
    setMergeError(null);
    const patch = buildPatch(survivor, other, choices, photoFrom);
    const result = await mergeDeaconsAction(survivor.id, other.id, patch);
    setMerging(false);
    if (!result.ok) {
      setMergeError(result.error);
      return;
    }
    setIdA(null);
    setIdB(null);
    setPreview(null);
    router.refresh();
  }

  const diffFields = preview && survivor && other ? FIELDS.filter((f) => differs(survivor, other, f.key)) : [];

  return (
    <div className="card">
      <h3>Merge Duplicate Records</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        For when the same person ended up with two roster records (e.g. added twice through the self-service
        form). Pick both records below, choose which values to keep, and confirm — the other record&apos;s
        attendance, Passion Week assignments, and login (if any) all move to the one you keep, and the
        duplicate is permanently deleted.
      </p>

      {!canEdit ? (
        <p className="muted">Only a System Admin can merge records.</p>
      ) : (
        <>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <CandidatePicker label="Record A" items={items} selectedId={idA} disabledId={idB} onSelect={selectA} />
            <CandidatePicker label="Record B" items={items} selectedId={idB} disabledId={idA} onSelect={selectB} />
          </div>

          {loading && <p className="muted">Loading…</p>}
          {loadError && <p className="error-text">{loadError}</p>}

          {preview && survivor && other && (
            <div>
              <div className="field" style={{ marginBottom: "1rem" }}>
                <label>Keep this record (its ID, login, and history stay under this name)</label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input type="radio" checked={survivorIsA} onChange={() => setSurvivorIsA(true)} />
                    {preview.a.name}
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      ({preview.a.participationCount + preview.a.passionWeekCount} history records)
                    </span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input type="radio" checked={!survivorIsA} onChange={() => setSurvivorIsA(false)} />
                    {preview.b.name}
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      ({preview.b.participationCount + preview.b.passionWeekCount} history records)
                    </span>
                  </label>
                </div>
              </div>

              {bothActiveLogins && (
                <p className="error-text" style={{ marginBottom: "1rem" }}>
                  Both records have an active login ({preview.a.linkedUserEmail} and {preview.b.linkedUserEmail}) —
                  remove or disable one in Access &amp; Roles before merging.
                </p>
              )}

              {diffFields.length === 0 ? (
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  Every field already matches — nothing to choose. History and login (if any) will still be
                  combined into the record you keep.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginBottom: "1rem" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>{survivor.name} (kept)</th>
                        <th>{other.name} (merged in)</th>
                        <th>Use</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffFields.map((f) => {
                        const choice = choices[f.key as string] ?? "a";
                        return (
                          <tr key={f.key as string}>
                            <td>{f.label}</td>
                            <td>{f.display(survivor)}</td>
                            <td>{f.display(other)}</td>
                            <td>
                              <select
                                value={choice}
                                onChange={(e) =>
                                  setChoices((c) => ({ ...c, [f.key as string]: e.target.value as FieldChoice }))
                                }
                              >
                                <option value="a">{survivor.name}&apos;s</option>
                                <option value="b">{other.name}&apos;s</option>
                                {f.combinable && <option value="combine">Combine both</option>}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(survivor.hasPhoto || other.hasPhoto) && survivor.hasPhoto !== other.hasPhoto && (
                <div className="field" style={{ marginBottom: "1rem" }}>
                  <label>Photo</label>
                  <select value={photoFrom ?? "survivor"} onChange={(e) => setPhotoFrom(e.target.value as "survivor" | "merged")}>
                    <option value="survivor">{survivor.hasPhoto ? `Keep ${survivor.name}'s photo` : `No photo (${survivor.name} has none)`}</option>
                    <option value="merged">{other.hasPhoto ? `Use ${other.name}'s photo` : `No photo (${other.name} has none)`}</option>
                  </select>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={merging || bothActiveLogins}
                  onClick={handleMerge}
                >
                  {merging ? "Merging…" : `Merge "${other.name}" into "${survivor.name}"`}
                </button>
              </div>
              {mergeError && <p className="error-text" style={{ marginTop: "0.5rem" }}>{mergeError}</p>}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLog((s) => !s)}>
          {showLog ? "Hide" : "Show"} merge history ({mergeLog.length})
        </button>
        {showLog && (
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kept</th>
                  <th>Merged in &amp; deleted</th>
                  <th>History moved</th>
                  <th>Login moved</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {mergeLog.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.mergedAt).toLocaleString()}</td>
                    <td>{m.survivorName}</td>
                    <td>{m.mergedName}</td>
                    <td>{m.participationMoved + m.passionWeekMoved}</td>
                    <td>{m.userRelinked ? "Yes" : "—"}</td>
                    <td>{m.mergedByEmail}</td>
                  </tr>
                ))}
                {mergeLog.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No merges yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
