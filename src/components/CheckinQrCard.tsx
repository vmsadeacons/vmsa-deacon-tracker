"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { QrChurch } from "@/lib/repo/checkinReview";
import { regenerateQrTokenAction } from "@/lib/actions/checkinReview";

/**
 * One QR code per church. It opens that church's check-in page; the liturgy is
 * never in the code -- the app picks whichever one is open when it's scanned.
 * Each code can be scanned, clicked (so an admin can check themselves in),
 * printed, or replaced with a fresh one that kills every old copy.
 */
export default function CheckinQrCard({ churches, isProduction }: { churches: QrChurch[]; isProduction: boolean }) {
  const router = useRouter();
  const [origin, setOrigin] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [printId, setPrintId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setOrigin(window.location.origin));
  }, []);

  const urlFor = (c: QrChurch) => `${origin}/qr?c=${c.token}`;

  // Draws every code in the browser (the address it points at is whatever this page is opened from).
  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        churches.map(
          async (c) =>
            [
              c.locationId,
              await QRCode.toDataURL(`${origin}/qr?c=${c.token}`, { margin: 1, width: 600, errorCorrectionLevel: "M" }),
            ] as const
        )
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, churches]);

  // Print just the chosen church's sheet: render it, open the print dialog, then put the page back.
  useEffect(() => {
    if (!printId) return;
    const done = () => setPrintId(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printId]);

  async function copyLink(c: QrChurch) {
    try {
      await navigator.clipboard.writeText(urlFor(c));
      setCopiedId(c.locationId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Couldn't copy the link — right-click the code and copy its address instead.");
    }
  }

  async function regenerate(c: QrChurch) {
    if (
      !window.confirm(
        `Make a new QR code for ${c.name}? Every printed copy and every photo of the current code will stop working, so the new one has to be printed and posted.`
      )
    ) {
      return;
    }
    setBusyId(c.locationId);
    setError(null);
    const res = await regenerateQrTokenAction(c.locationId);
    setBusyId(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  const printing = churches.find((c) => c.locationId === printId);

  return (
    <div className="card">
      <h3>Check-in QR codes</h3>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        One code per church, good for any day and any liturgy — the app checks the person into whichever liturgy is open
        when they scan it. Deacons scan it with their phone camera. Admins can scan it too, or just click it to check
        themselves in. If someone isn&apos;t at the church when they scan, the check-in is still accepted but shows up on
        the Check-in review page.
      </p>
      {!isProduction && (
        <p className="error-text" style={{ marginBottom: "1rem" }}>
          You&apos;re on a test version of the site. Codes shown here point at this test address, so don&apos;t print
          them for the church — print from the live site once it&apos;s rolled out.
        </p>
      )}
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))", gap: "1rem" }}>
        {churches.map((c) => (
          <div
            key={c.locationId}
            style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.9rem", textAlign: "center" }}
          >
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{c.name}</div>
            {images[c.locationId] ? (
              <a href={urlFor(c)} target="_blank" rel="noopener noreferrer" title="Click to check in yourself">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[c.locationId]}
                  alt={`Check-in QR code for ${c.name}`}
                  style={{ width: "100%", maxWidth: 220, height: "auto", imageRendering: "pixelated" }}
                />
              </a>
            ) : (
              <div className="muted" style={{ padding: "4rem 0" }}>Drawing…</div>
            )}
            <div className="muted" style={{ fontSize: "0.8rem", margin: "0.4rem 0 0.7rem" }}>
              Scan, or click to check in
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!images[c.locationId]}
                onClick={() => setPrintId(c.locationId)}
              >
                Print
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!origin} onClick={() => copyLink(c)}>
                {copiedId === c.locationId ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busyId === c.locationId}
                onClick={() => regenerate(c)}
              >
                New code
              </button>
            </div>
          </div>
        ))}
      </div>

      {printing && images[printing.locationId] && (
        <div className="qr-print-sheet">
          <h1 style={{ fontSize: "2.6rem", margin: 0 }}>{printing.name}</h1>
          <p style={{ fontSize: "1.6rem", margin: "0.6rem 0 1.6rem" }}>Scan to check in</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[printing.locationId]}
            alt=""
            style={{ width: "min(70vw, 560px)", height: "auto", imageRendering: "pixelated" }}
          />
          <p style={{ fontSize: "1.1rem", marginTop: "1.6rem" }}>Open your phone&apos;s camera and point it at the code.</p>
        </div>
      )}
    </div>
  );
}
