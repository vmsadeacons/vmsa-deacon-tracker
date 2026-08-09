"use client";

import { ALL_SENTINEL } from "@/lib/constants";

export interface ChipOption {
  value: string;
  label: string;
}

export default function ChipMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    if (value === ALL_SENTINEL) {
      onChange(selected.includes(ALL_SENTINEL) ? [] : [ALL_SENTINEL]);
      return;
    }
    const withoutAll = selected.filter((v) => v !== ALL_SENTINEL);
    if (withoutAll.includes(value)) {
      onChange(withoutAll.filter((v) => v !== value));
    } else {
      onChange([...withoutAll, value]);
    }
  }

  return (
    <div className="chip-row">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          className={`chip ${selected.includes(opt.value) ? "active" : ""}`}
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
        </button>
      ))}
      <button
        type="button"
        className={`chip ${selected.includes(ALL_SENTINEL) ? "active" : ""}`}
        onClick={() => toggle(ALL_SENTINEL)}
      >
        All
      </button>
    </div>
  );
}
