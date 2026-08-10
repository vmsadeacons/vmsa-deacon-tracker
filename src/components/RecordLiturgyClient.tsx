"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiturgyPicker from "./LiturgyPicker";
import Modal from "./Modal";
import type { LocationRow } from "@/lib/repo/locations";
import type { ActivityRow } from "@/lib/repo/activities";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LiturgyContext } from "@/lib/repo/liturgies";
import type { ServiceTypeCode } from "@/lib/constants";
import {
  openLiturgyAction,
  refreshLiturgyAction,
  toggleAttendanceAction,
  toggleAltarAction,
  setReadingAction,
} from "@/app/(app)/record/actions";

const POLL_MS = 20000;

function matchesPrefs(prefs: string[], value: string): boolean {
  return prefs.includes("All") || prefs.includes(value);
}

export default function RecordLiturgyClient({
  locations,
  activities,
  deacons,
  initialDate,
  initialLocationId,
  initialServiceType,
  initialLiturgyId,
  initialContext,
}: {
  locations: LocationRow[];
  activities: ActivityRow[];
  deacons: DeaconWithAgeGroup[];
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
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liturgyIdRef = useRef(liturgyId);
  useEffect(() => {
    liturgyIdRef.current = liturgyId;
  }, [liturgyId]);
  // Guards against out-of-order responses: an older field-change fetch
  // resolving after a newer one, or a poll/mutation response landing after
  // the selected liturgy has since changed.
  const fieldChangeSeqRef = useRef(0);

  const loadLiturgy = useCallback(async (d: string, l: string, s: ServiceTypeCode) => {
    const seq = ++fieldChangeSeqRef.current;
    const result = await openLiturgyAction(d, l, s);
    if (seq !== fieldChangeSeqRef.current) return;
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
      const targetLiturgyId = liturgyIdRef.current;
      if (!targetLiturgyId) return;
      const fresh = await refreshLiturgyAction(targetLiturgyId);
      if (liturgyIdRef.current !== targetLiturgyId) return;
      setContext(fresh);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const attendeeIds = context?.attendeeIds ?? [];
  const activeCandidates = deacons.filter(
    (d) =>
      attendeeIds.includes(d.id) ||
      (d.status === "Active" &&
        matchesPrefs(d.location_prefs, locationId) &&
        matchesPrefs(d.liturgy_prefs, serviceType))
  );
  const allRosterSorted = [...deacons]
    .filter((d) => d.status === "Active" || attendeeIds.includes(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  function showNotice(text: string) {
    setNotice(text);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setNotice(null), 8000);
  }

  async function handleToggleAttendance(deaconId: string) {
    if (!liturgyId) return;
    const targetLiturgyId = liturgyId;
    const wasAttending = attendeeIds.includes(deaconId);
    // optimistic update
    setContext((prev) =>
      prev
        ? {
            ...prev,
            attendeeIds: wasAttending
              ? prev.attendeeIds.filter((id) => id !== deaconId)
              : [...prev.attendeeIds, deaconId],
          }
        : prev
    );
    const fresh = await toggleAttendanceAction(targetLiturgyId, deaconId);
    if (liturgyIdRef.current !== targetLiturgyId) return;
    setContext(fresh);

    // Assigning an activity implies attendance (spec §5) -- the chip can
    // only ever add/remove the plain marker, so someone with an active
    // assignment stays "attending" no matter what. Explain why, rather
    // than letting the click silently appear to do nothing.
    if (wasAttending && fresh.attendeeIds.includes(deaconId)) {
      const name = fresh.attendees.find((a) => a.deaconId === deaconId)?.name ?? "This deacon";
      const assignedTo = fresh.assignments
        .filter((a) => a.deaconIds.includes(deaconId))
        .map((a) => a.activityName);
      if (assignedTo.length > 0) {
        showNotice(
          `${name} still shows as attending because they're assigned to ${assignedTo.join(", ")}. Clear those activities first if you intend to remove their attendance.`
        );
      }
    }
  }

  async function handleToggleAltar(activityId: string, deaconId: string) {
    if (!liturgyId) return;
    const targetLiturgyId = liturgyId;
    const fresh = await toggleAltarAction(targetLiturgyId, activityId, deaconId);
    if (liturgyIdRef.current !== targetLiturgyId) return;
    setContext(fresh);
  }

  async function handleSetReading(activityId: string, deaconId: string) {
    if (!liturgyId) return;
    const targetLiturgyId = liturgyId;
    const fresh = await setReadingAction(targetLiturgyId, activityId, deaconId || null);
    if (liturgyIdRef.current !== targetLiturgyId) return;
    setContext(fresh);
  }

  const altarActivity = activities.find((a) => a.allows_multiple);
  const readingActivities = activities.filter((a) => !a.allows_multiple);
  const attendees = context?.attendees ?? [];

  return (
    <div>
      <h1>Record a Liturgy</h1>

      <div className="card">
        <div className="step-header">1 · Which liturgy?</div>
        <LiturgyPicker
          date={date}
          locationId={locationId}
          serviceType={serviceType}
          locations={locations}
          onChange={handleFieldChange}
        />
      </div>

      <div className="card">
        <div className="step-header">2 · Who attended?</div>
        {notice && (
          <div
            style={{
              background: "var(--amber-bg)",
              color: "var(--amber)",
              borderRadius: 10,
              padding: "0.65rem 0.9rem",
              marginBottom: "0.85rem",
              fontSize: "0.88rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", color: "var(--amber)", cursor: "pointer", fontWeight: 700 }}
            >
              ×
            </button>
          </div>
        )}
        <div className="chip-row">
          {activeCandidates.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`chip ${attendeeIds.includes(d.id) ? "active" : ""}`}
              onClick={() => handleToggleAttendance(d.id)}
            >
              {d.name}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setShowMore(true)}>
            more…
          </button>
        </div>
      </div>

      {altarActivity && (
        <div className="card">
          <div className="step-header">3 · Altar Service</div>
          <div className="chip-row">
            {attendees.length === 0 && <p className="muted">Mark attendance first.</p>}
            {attendees.map((a) => {
              const assignment = context?.assignments.find((x) => x.activityId === altarActivity.id);
              const active = assignment?.deaconIds.includes(a.deaconId) ?? false;
              return (
                <button
                  key={a.deaconId}
                  type="button"
                  className={`chip ${active ? "active" : ""}`}
                  onClick={() => handleToggleAltar(altarActivity.id, a.deaconId)}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {readingActivities.length > 0 && (
        <div>
          <h3>4 · Readings</h3>
          <div className="grid-2">
            {readingActivities.map((act) => {
              const assignment = context?.assignments.find((x) => x.activityId === act.id);
              const current = assignment?.deaconIds[0] ?? "";
              return (
                <div key={act.id} className="card">
                  <div className="step-header">{act.name}</div>
                  <select value={current} onChange={(e) => handleSetReading(act.id, e.target.value)}>
                    <option value="">— none —</option>
                    {attendees.map((a) => (
                      <option key={a.deaconId} value={a.deaconId}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showMore} onClose={() => setShowMore(false)} title="Full roster">
        <div className="chip-row">
          {allRosterSorted.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`chip ${attendeeIds.includes(d.id) ? "active" : ""}`}
              onClick={() => handleToggleAttendance(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
