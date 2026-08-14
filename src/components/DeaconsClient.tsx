"use client";

import { useMemo, useState } from "react";
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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function DeaconsClient({
  deacons,
  locations,
  ranks,
}: {
  deacons: DeaconWithAgeGroup[];
  locations: LocationRow[];
  ranks: RankRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DeaconWithAgeGroup | null>(null);
  const [viewing, setViewing] = useState<DeaconWithAgeGroup | null>(null);
  const [adding, setAdding] = useState(searchParams.get("add") === "1");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = useMemo(() => [...deacons].sort((a, b) => a.name.localeCompare(b.name)), [deacons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sorted.filter((d) => d.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, search]);

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
      router.replace("/deacons");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Deacons</h1>
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

      <div className="card">
        <input
          type="text"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
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
                      className="card"
                      style={{ marginBottom: 0, cursor: "pointer" }}
                      onClick={() => setViewing(d)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <DeaconAvatar
                          deaconId={d.id}
                          hasPhoto={d.has_photo}
                          firstName={d.first_name}
                          lastName={d.last_name}
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
                          <div className="muted" style={{ fontSize: "0.85rem" }}>{d.age_group ?? "—"}</div>
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
      >
        <DeaconForm
          initial={null}
          locations={locations}
          ranks={ranks}
          error={formError}
          onCancel={() => {
            setAdding(false);
            setFormError(null);
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
      >
        {editing && (
          <DeaconForm
            initial={editing}
            locations={locations}
            ranks={ranks}
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
