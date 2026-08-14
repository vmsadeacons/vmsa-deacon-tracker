"use client";

import { ALL_SENTINEL } from "@/lib/constants";

export interface ChipOption {
  value: string;
  label: string;
  disabled?: boolean; // shown greyed out, non-clickable (e.g. an inactive location)
}

export default function ChipMultiSelect({
  options,
  selected,
  onChange,
  hideAllOption,
}: {
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  hideAllOption?: boolean;
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
          className={`chip ${selected.includes(opt.value) ? "active" : ""} ${opt.disabled ? "disabled" : ""}`}
          onClick={() => !opt.disabled && toggle(opt.value)}
          title={opt.disabled ? "Inactive — no longer selectable" : undefined}
        >
          {opt.label}
        </button>
      ))}
      {!hideAllOption && (
        <button
          type="button"
          className={`chip ${selected.includes(ALL_SENTINEL) ? "active" : ""}`}
          onClick={() => toggle(ALL_SENTINEL)}
        >
          All
        </button>
      )}
    </div>
  );
}
