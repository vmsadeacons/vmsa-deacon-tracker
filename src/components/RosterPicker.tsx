"use client";

import { useMemo, useState } from "react";
import NameSearchBox from "./NameSearchBox";
import { matchesNameSearch, type NameSearchMode } from "@/lib/rosterSearch";

export interface RosterPickerItem {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Search + A-Z jump strip over a large roster — see the demo mockup this was built from. */
export default function RosterPicker({
  items,
  selectedIds,
  disabledIds,
  onToggle,
  idPrefix = "roster",
}: {
  items: RosterPickerItem[];
  selectedIds: string[];
  disabledIds?: string[];
  onToggle: (id: string) => void;
  idPrefix?: string;
}) {
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<NameSearchMode>("full");

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  const filtered = useMemo(
    () => sorted.filter((i) => matchesNameSearch(i, searchMode, search)),
    [sorted, search, searchMode]
  );

  const groups = useMemo(() => {
    const map = new Map<string, RosterPickerItem[]>();
    for (const item of filtered) {
      const letter = /[A-Za-z]/.test(item.name[0] ?? "") ? item.name[0].toUpperCase() : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(item);
    }
    return map;
  }, [filtered]);

  const availableLetters = new Set(groups.keys());

  function jumpTo(letter: string) {
    document.getElementById(`${idPrefix}-sec-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <NameSearchBox
        query={search}
        onQueryChange={setSearch}
        mode={searchMode}
        onModeChange={setSearchMode}
        idPrefix={idPrefix}
      />
      <div style={{ display: "flex", height: 340 }}>
        <div
          style={{
            width: 24,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflowY: "auto",
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
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingLeft: "0.75rem" }}>
          {[...groups.entries()].map(([letter, groupItems]) => (
            <div key={letter} id={`${idPrefix}-sec-${letter}`} style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "0.8rem",
                  color: "var(--gold)",
                  fontWeight: 700,
                  margin: "0.4rem 0",
                }}
              >
                {letter}
              </div>
              <div className="chip-row">
                {groupItems.map((item) => {
                  const disabled = disabledIds?.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${selectedIds.includes(item.id) ? "active" : ""} ${disabled ? "disabled" : ""}`}
                      onClick={() => !disabled && onToggle(item.id)}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">No matches.</p>}
        </div>
      </div>
    </div>
  );
}
