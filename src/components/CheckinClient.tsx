"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiturgyPicker from "./LiturgyPicker";
import type { LocationRow } from "@/lib/repo/locations";
import type { LiturgyContext } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";
import { openCheckinLiturgyAction, refreshCheckinAction, checkInSelfAction, undoCheckInSelfAction } from "@/app/(app)/checkin/actions";

const POLL_MS = 20000;

export default function CheckinClient({
  locations,
  linkedDeaconId,
  initialDate,
  initialLocationId,
  initialServiceType,
  initialLiturgyId,
  initialContext,
}: {
  locations: LocationRow[];
  linkedDeaconId: string | null;
  initialDate: string;
  initialLocationId: string;
  initialServiceType: ServiceTypeCode;
  initialLiturgyId: string | null;
  initialContext: LiturgyContext | null;
}) {
  const [date, setDate] = useState(initialDate);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [serviceType, setServiceType] = useState(initialServiceType);
  const [liturgyId, setLiturgyId] = useState(initialLiturgyId);
  const [context, setContext] = useState(initialContext);
  const [busy, setBusy] = useState(false);
  const liturgyIdRef = useRef(liturgyId);
  liturgyIdRef.current = liturgyId;

  const loadLiturgy = useCallback(async (d: string, l: string, s: ServiceTypeCode) => {
    const result = await openCheckinLiturgyAction(d, l, s);
    setLiturgyId(result.liturgyId);
    setContext(result.context);
  }, []);

  function handleFieldChange(d: string, l: string, s: ServiceTypeCode) {
    setDate(d);
    setLocationId(l);
    setServiceType(s);
    loadLiturgy(d, l, s);
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!liturgyIdRef.current) return;
      setContext(await refreshCheckinAction(liturgyIdRef.current));
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const attending = Boolean(linkedDeaconId && context?.attendeeIds.includes(linkedDeaconId));

  async function handleCheckIn() {
    if (!liturgyId) return;
    setBusy(true);
    try {
      setContext(await checkInSelfAction(liturgyId));
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo() {
    if (!liturgyId) return;
    setBusy(true);
    try {
      setContext(await undoCheckInSelfAction(liturgyId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Check-in</h1>

      <div className="card">
        <LiturgyPicker
          date={date}
          locationId={locationId}
          serviceType={serviceType}
          locations={locations}
          onChange={handleFieldChange}
        />
      </div>

      {!linkedDeaconId ? (
        <div className="card">
          <p className="muted">
            Your account isn&apos;t linked to a deacon record yet — ask a System Admin to link you before checking in.
          </p>
        </div>
      ) : (
        <div className="card">
          <button className="btn btn-primary" disabled={busy} onClick={attending ? handleUndo : handleCheckIn}>
            {attending ? "Undo check-in" : "I'm here"}
          </button>
        </div>
      )}

      <div className="card">
        <h3>Who else has checked in</h3>
        {context && context.attendees.length > 0 ? (
          <div className="chip-row">
            {context.attendees.map((a) => (
              <span key={a.deaconId} className="badge badge-green">
                {a.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">No one yet.</p>
        )}
      </div>
    </div>
  );
}
