"use client";

import { useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import Modal from "./Modal";
import { cropAndResize } from "@/lib/cropImage";

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

/** Fully controlled: the parent decides what photoSrc means (an API URL for an
 * existing deacon, a local data: URL for one not yet saved) and what happens
 * when a crop finishes (upload immediately, or just hold it until form save). */
export default function PhotoEditor({
  photoSrc,
  firstName,
  lastName,
  onChange,
  onDelete,
  showDelete,
}: {
  photoSrc: string | null;
  firstName: string;
  lastName: string;
  onChange: (dataUrl: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  showDelete: boolean;
}) {
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSaveCrop() {
    if (!rawImage || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const dataUrl = await cropAndResize(rawImage, croppedAreaPixels, 200);
      await onChange(dataUrl);
      setRawImage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const avatarStyle: React.CSSProperties = {
    width: 80,
    height: 80,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 600,
    overflow: "hidden",
    background: "var(--wine-bg)",
    color: "var(--wine)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
      {photoSrc ? (
        <img src={photoSrc} alt="" style={{ ...avatarStyle, objectFit: "cover" }} />
      ) : (
        <div style={avatarStyle}>{initialsOf(firstName, lastName)}</div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {photoSrc ? "Replace photo" : "Upload photo"}
        </button>
        {showDelete && photoSrc && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>

      <Modal open={!!rawImage} onClose={() => setRawImage(null)} title="Trim photo">
        {rawImage && (
          <div>
            <div style={{ position: "relative", width: "100%", height: 320, background: "#00000010" }}>
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>
            <div className="field" style={{ marginTop: "1rem" }}>
              <label>Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRawImage(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveCrop} disabled={saving}>
                {saving ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
