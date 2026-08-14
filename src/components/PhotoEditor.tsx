"use client";

import { useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import Modal from "./Modal";
import DeaconAvatar from "./DeaconAvatar";
import { cropAndResize } from "@/lib/cropImage";

export default function PhotoEditor({
  deaconId,
  firstName,
  lastName,
  hasPhoto: initialHasPhoto,
  onUpload,
  onDelete,
}: {
  deaconId: string;
  firstName: string;
  lastName: string;
  hasPhoto: boolean;
  onUpload: (dataUrl: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [hasPhoto, setHasPhoto] = useState(initialHasPhoto);
  const [version, setVersion] = useState(0);
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
      await onUpload(dataUrl);
      setHasPhoto(true);
      setVersion((v) => v + 1);
      setRawImage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      setHasPhoto(false);
      setVersion((v) => v + 1);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
      <DeaconAvatar
        deaconId={deaconId}
        hasPhoto={hasPhoto}
        firstName={firstName}
        lastName={lastName}
        size={80}
        version={version}
      />
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
          {hasPhoto ? "Replace photo" : "Upload photo"}
        </button>
        {hasPhoto && (
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
