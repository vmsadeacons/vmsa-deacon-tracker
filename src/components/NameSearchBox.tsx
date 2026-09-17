"use client";

import { NAME_SEARCH_MODE_LABELS, type NameSearchMode } from "@/lib/rosterSearch";

const MODES: NameSearchMode[] = ["full", "first", "last"];

/** The search input + Full/First/Last mode row shared by RosterPicker and the Deacons roster page. */
export default function NameSearchBox({
  query,
  onQueryChange,
  mode,
  onModeChange,
  idPrefix,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  mode: NameSearchMode;
  onModeChange: (mode: NameSearchMode) => void;
  idPrefix: string;
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <input
        type="text"
        placeholder="Search by name"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        style={{ width: "100%", marginBottom: "0.4rem", boxSizing: "border-box" }}
      />
      <div className="chip-row" role="radiogroup" aria-label="Search mode" style={{ flexWrap: "nowrap" }}>
        {MODES.map((m) => (
          <label
            key={m}
            className={`chip chip-sm ${mode === m ? "active" : ""}`}
            style={{ position: "relative", flex: "1 1 0", justifyContent: "center", textAlign: "center" }}
          >
            <input
              type="radio"
              name={`${idPrefix}-name-search-mode`}
              value={m}
              checked={mode === m}
              onChange={() => onModeChange(m)}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", margin: 0 }}
            />
            {NAME_SEARCH_MODE_LABELS[m]}
          </label>
        ))}
      </div>
    </div>
  );
}
