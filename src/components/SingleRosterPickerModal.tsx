"use client";

import { useState } from "react";
import Modal from "./Modal";
import RosterPicker, { type RosterPickerItem } from "./RosterPicker";

/** A plain-dropdown replacement: shows the current pick, opens a searchable picker to change it. */
export default function SingleRosterPickerModal({
  items,
  selectedId,
  onSelect,
  placeholder = "— none —",
  title = "Choose a deacon",
  idPrefix,
}: {
  items: RosterPickerItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placeholder?: string;
  title?: string;
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === selectedId);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ width: "100%", justifyContent: "space-between" }}
        onClick={() => setOpen(true)}
      >
        {selected ? selected.name : placeholder}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div style={{ marginBottom: "0.75rem" }}>
          <button
            type="button"
            className="chip"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
          >
            — none —
          </button>
        </div>
        <RosterPicker
          items={items}
          selectedIds={selectedId ? [selectedId] : []}
          idPrefix={idPrefix}
          onToggle={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
