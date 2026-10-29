"use client";

import { useState } from "react";
import Modal from "./Modal";

/**
 * A card's title plus its explanatory text. On a computer the text sits under
 * the title as usual; on a phone it's tucked behind a small "i" icon beside the
 * title and opens in a window, so the card doesn't start with a wall of words.
 * `children` shows in both places; `phoneOnly` is extra text that only goes in
 * the window (for notes that sit lower in the card on a computer).
 */
export default function InfoHeading({
  title,
  children,
  phoneOnly,
}: {
  title: string;
  children: React.ReactNode;
  phoneOnly?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="info-head">
        <h3>{title}</h3>
        <button type="button" className="info-btn" aria-label={`About ${title}`} onClick={() => setOpen(true)}>
          i
        </button>
      </div>
      <div className="info-inline">{children}</div>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {children}
        {phoneOnly}
      </Modal>
    </>
  );
}
