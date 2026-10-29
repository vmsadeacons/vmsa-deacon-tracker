"use client";

import AccessNote, { ACCESS } from "./AccessNote";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "./Modal";
import DeaconForm from "./DeaconForm";
import DeaconDetailModal from "./DeaconDetailModal";
import DeaconAvatar from "./DeaconAvatar";
import type { DeaconWithAgeGroup, DeaconInput } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import type { RankRow } from "@/lib/repo/ranks";
import { createDeaconAction, updateDeaconAction, deleteDeaconAction, setDeaconPhotoAction } from "@/app/(app)/deacons/actions";
import { formatPhone, telHref, smsHref } from "@/lib/formatPhone";
import NameSearchBox from "./NameSearchBox";
import { matchesNameSearch, type NameSearchMode } from "@/lib/rosterSearch";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function DeaconsClient({
  deacons,
  locations,
  ranks,
  ageGroupThresholds,
}: {
  deacons: DeaconWithAgeGroup[];
  locations: LocationRow[];
  ranks: RankRow[];
  ageGroupThresholds: { youthMin: number; adultMin: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<NameSearchMode>("full");
  const [editing, setEditing] = useState<DeaconWithAgeGroup | null>(
    () => deacons.find((d) => d.id === searchParams.get("edit")) ?? null
  );
  const [viewing, setViewing] = useState<DeaconWithAgeGroup | null>(null);
  const [adding, setAdding] = useState(searchParams.get("add") === "1");
  // Arrived from Record a Liturgy's "Add a Deacon" button: offer a clear way back.
  const fromRecord = searchParams.get("from") === "record";
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = useMemo(() => [...deacons].sort((a, b) => a.name.localeCompare(b.name)), [deacons]);

  const filtered = useMemo(
    () =>
      sorted.filter((d) =>
        matchesNameSearch({ name: d.name, firstName: d.first_name, lastName: d.last_name }, searchMode, search)
      ),
    [sorted, search, searchMode]
  );

  const groups = useMemo(() => {
    const map = new Map<string, DeaconWithAgeGroup[]>();
    for (const d of filtered) {
      const letter = /[A-Za-z]/.test(d.first_name[0] ?? "") ? d.first_name[0].toUpperCase() : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(d);
    }
    return map;
  }, [filtered]);

  const availableLetters = new Set(groups.keys());

  function jumpTo(letter: string) {
    document.getElementById(`deacons-sec-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreate(input: DeaconInput, pendingPhotoDataUrl: string | null) {
    setFormError(null);
    const result = await createDeaconAction(input);
    if (result.ok) {
      if (pendingPhotoDataUrl) {
        await setDeaconPhotoAction(result.deacon.id, pendingPhotoDataUrl);
      }
      setAdding(false);
      if (fromRecord) {
        setJustAdded(result.deacon.name);
        window.scrollTo(0, 0);
        router.replace("/deacons?from=record");
      } else {
        router.replace("/deacons");
      }
      router.refresh();
    } else {
      setFormError(result.error);
    }
  }

  async function handleUpdate(input: DeaconInput) {
    if (!editing) return;
    setFormError(null);
    const result = await updateDeaconAction(editing.id, input);
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setFormError(result.error);
    }
  }

  async function handleDelete(deacon: DeaconWithAgeGroup) {
    if (!confirm(`Permanently delete ${deacon.name}? This can't be undone.`)) return;
    const result = await deleteDeaconAction(deacon.id);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setViewing(null);
    router.refresh();
  }

  return (
    <div>
      {fromRecord && (
        <Link href="/record" style={{ display: "inline-block", marginBottom: "0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>
          ← Back to Record a Liturgy
        </Link>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Deacons</h1>
          <AccessNote tight>{ACCESS.adminsEdit}</AccessNote>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setAdding(true);
          }}
        >
          Add deacon
        </button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: "1rem" }}>{error}</p>}

      {fromRecord && justAdded && (
        <div className="card">
          <p style={{ margin: "0 0 0.75rem", color: "var(--green)", fontWeight: 600 }}>
            {justAdded} was added to the roster.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link href="/record" className="btn btn-primary">
              Back to Record a Liturgy
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFormError(null);
                setJustAdded(null);
                setAdding(true);
              }}
            >
              Add another deacon
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <NameSearchBox
          query={search}
          onQueryChange={setSearch}
          mode={searchMode}
          onModeChange={setSearchMode}
          idPrefix="deacons"
        />
        <div style={{ display: "flex" }}>
          <div
            style={{
              width: 24,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {ALPHABET.map((letter) => {
              const has = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => has && jumpTo(letter)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 10,
                    padding: "1px 0",
                    width: 20,
                    cursor: has ? "pointer" : "default",
                    color: has ? "var(--wine)" : "var(--muted-2)",
                    opacity: has ? 1 : 0.4,
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingLeft: "0.75rem" }}>
            {[...groups.entries()].map(([letter, groupDeacons]) => (
              <div key={letter} id={`deacons-sec-${letter}`} style={{ marginBottom: "1rem" }}>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "0.85rem",
                    color: "var(--gold)",
                    fontWeight: 700,
                    margin: "0.5rem 0",
                  }}
                >
                  {letter}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: "0.6rem",
                  }}
                >
                  {groupDeacons.map((d) => (
                    <div
                      key={d.id}
                      className="card card-deacon"
                      style={{ marginBottom: 0, cursor: "pointer" }}
                      onClick={() => setViewing(d)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <DeaconAvatar
                          deaconId={d.id}
                          hasPhoto={d.has_photo}
                          firstName={d.first_name}
                          lastName={d.last_name}
                          isGuest={d.is_guest}
                          updatedAt={d.updated_at}
                          size={40}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {d.name}
                            {d.is_guest && (
                              <span className="badge badge-gold" style={{ marginLeft: "0.4rem" }}>
                                Guest
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ fontSize: "0.85rem" }}>
                            {[d.age_group, d.rank?.replace(/\s*\(.*\)\s*$/, ""), d.ordination_year]
                              .filter(Boolean)
                              .join(" . ") || "—"}
                          </div>
                        </div>
                      </div>
                      {d.phone && (
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="muted" style={{ fontSize: "0.9rem" }}>{formatPhone(d.phone)}</span>
                          <a className="btn btn-secondary btn-sm" href={telHref(d.phone)}>
                            Call
                          </a>
                          <a className="btn btn-secondary btn-sm" href={smsHref(d.phone)}>
                            Text
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="muted">No matches.</p>}
          </div>
        </div>
      </div>

      <DeaconDetailModal
        deacon={viewing}
        locations={locations}
        onClose={() => setViewing(null)}
        onEdit={(d) => {
          setViewing(null);
          setFormError(null);
          setEditing(d);
        }}
        onDelete={handleDelete}
      />

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setFormError(null);
        }}
        title="Add deacon"
        wide
        preventDismiss
      >
        <DeaconForm
          initial={null}
          locations={locations}
          ranks={ranks}
          ageGroupThresholds={ageGroupThresholds}
          error={formError}
          onCancel={() => {
            setAdding(false);
            setFormError(null);
            if (fromRecord) router.push("/record");
          }}
          onSave={handleCreate}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          setEditing(null);
          setFormError(null);
        }}
        title="Edit deacon"
        wide
        preventDismiss
      >
        {editing && (
          <DeaconForm
            initial={editing}
            locations={locations}
            ranks={ranks}
            ageGroupThresholds={ageGroupThresholds}
            error={formError}
            onCancel={() => {
              setEditing(null);
              setFormError(null);
            }}
            onSave={handleUpdate}
          />
        )}
      </Modal>
    </div>
  );
}
