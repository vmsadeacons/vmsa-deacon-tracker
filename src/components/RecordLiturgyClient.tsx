"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiturgyPicker from "./LiturgyPicker";
import Modal from "./Modal";
import RosterPicker from "./RosterPicker";
import SingleRosterPickerModal from "./SingleRosterPickerModal";
import SpecialFeastControl from "./SpecialFeastControl";
import type { LocationRow } from "@/lib/repo/locations";
import type { ActivityRow } from "@/lib/repo/activities";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { FeastNameRow } from "@/lib/repo/feastNames";
import type { LiturgyContext } from "@/lib/repo/liturgies";
import type { SuggestionEntry } from "@/lib/repo/suggestions";
import type { ServiceTypeCode } from "@/lib/constants";
import { liturgyPrefMatchCodes } from "@/lib/timezone";
import {
  openLiturgyAction,
  refreshLiturgyAction,
  toggleAttendanceAction,
  toggleAltarAction,
  setReadingAction,
  setSpecialFeastAction,
  getServiceSuggestionsAction,
} from "@/app/(app)/record/actions";

const POLL_MS = 20000;

function matchesPrefs(prefs: string[], codes: string[]): boolean {
  return prefs.includes("All") || codes.some((c) => prefs.includes(c));
}

export default function RecordLiturgyClient({
  locations,
  activities,
  deacons,
  feastNames,
  initialDate,
  initialLocationId,
  initialServiceType,
  initialLiturgyId,
  initialContext,
}: {
  locations: LocationRow[];
  activities: ActivityRow[];
  deacons: DeaconWithAgeGroup[];
  feastNames: FeastNameRow[];
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
  // Since no liturgy row (and so no liturgyId) may exist yet, toggle
  // handlers key their staleness check off date/location/service instead --
  // kept in refs so the check compares against the latest value, not the
  // value closed over when the handler's async call started.
  const dateRef = useRef(date);
  const locationIdRef = useRef(locationId);
  const serviceTypeRef = useRef(serviceType);
  useEffect(() => {
    dateRef.current = date;
    locationIdRef.current = locationId;
    serviceTypeRef.current = serviceType;
  }, [date, locationId, serviceType]);
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
  const servicePrefCodes = [
    ...liturgyPrefMatchCodes(date, serviceType),
    ...(context?.isSpecialFeast ? ["Feast"] : []),
  ];
  const activeCandidates = deacons.filter(
    (d) =>
      attendeeIds.includes(d.id) ||
      (d.status === "Active" &&
        matchesPrefs(d.location_prefs, [locationId]) &&
        matchesPrefs(d.liturgy_prefs, servicePrefCodes))
  );
  const allRosterSorted = [...deacons]
    .filter((d) => d.status === "Active" || attendeeIds.includes(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Who's most overdue for Altar Service / Readings, among whoever's
  // currently marked present -- re-fetched whenever the actual set of
  // attendees changes (a stable string key, not the array reference, so an
  // unrelated context update like an assignment change doesn't re-fetch).
  const [suggestions, setSuggestions] = useState<{
    altar: SuggestionEntry[];
    readings: SuggestionEntry[];
    windowMonths: number;
  }>({ altar: [], readings: [], windowMonths: 0 });
  const suggestionSeqRef = useRef(0);
  const attendeeIdsKey = attendeeIds.join(",");
  useEffect(() => {
    const seq = ++suggestionSeqRef.current;
    getServiceSuggestionsAction(attendeeIds).then((res) => {
      if (seq !== suggestionSeqRef.current) return;
      setSuggestions(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendeeIdsKey]);

  function showNotice(text: string) {
    setNotice(text);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setNotice(null), 8000);
  }

  async function handleToggleAttendance(deaconId: string) {
    const targetDate = date;
    const targetLocationId = locationId;
    const targetServiceType = serviceType;
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
    const fresh = await toggleAttendanceAction(targetDate, targetLocationId, targetServiceType, deaconId);
    if (
      dateRef.current !== targetDate ||
      locationIdRef.current !== targetLocationId ||
      serviceTypeRef.current !== targetServiceType
    )
      return;
    setLiturgyId(fresh.liturgyId);
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
    const targetDate = date;
    const targetLocationId = locationId;
    const targetServiceType = serviceType;
    const fresh = await toggleAltarAction(targetDate, targetLocationId, targetServiceType, activityId, deaconId);
    if (
      dateRef.current !== targetDate ||
      locationIdRef.current !== targetLocationId ||
      serviceTypeRef.current !== targetServiceType
    )
      return;
    setLiturgyId(fresh.liturgyId);
    setContext(fresh);
  }

  async function handleSetReading(activityId: string, deaconId: string) {
    const targetDate = date;
    const targetLocationId = locationId;
    const targetServiceType = serviceType;
    const fresh = await setReadingAction(targetDate, targetLocationId, targetServiceType, activityId, deaconId || null);
    if (
      dateRef.current !== targetDate ||
      locationIdRef.current !== targetLocationId ||
      serviceTypeRef.current !== targetServiceType
    )
      return;
    setLiturgyId(fresh.liturgyId);
    setContext(fresh);
  }

  async function handleSaveFeast(isSpecialFeast: boolean, feastNameId: string | null) {
    const targetDate = date;
    const targetLocationId = locationId;
    const targetServiceType = serviceType;
    const result = await setSpecialFeastAction(targetDate, targetLocationId, targetServiceType, isSpecialFeast, feastNameId);
    if (
      dateRef.current !== targetDate ||
      locationIdRef.current !== targetLocationId ||
      serviceTypeRef.current !== targetServiceType
    )
      return result;
    if (result.ok) {
      setLiturgyId(result.context.liturgyId);
      setContext(result.context);
    }
    return result;
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
        <SpecialFeastControl
          key={`${date}|${locationId}|${serviceType}`}
          isSpecialFeast={context?.isSpecialFeast ?? false}
          feastNameId={context?.feastNameId ?? null}
          feastNames={feastNames}
          onSave={handleSaveFeast}
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
        <RosterPicker
          items={activeCandidates.map((d) => ({ id: d.id, name: d.name }))}
          selectedIds={attendeeIds}
          onToggle={handleToggleAttendance}
          idPrefix="attend"
        />
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => setShowMore(true)}>
          more…
        </button>
      </div>

      {altarActivity && (
        <div className="card">
          <div className="step-header">3 · Altar Service</div>
          {suggestions.altar.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Suggested (lowest altar % over the last {suggestions.windowMonths} month
                {suggestions.windowMonths === 1 ? "" : "s"}) — tap to add
              </p>
              <div className="chip-row" style={{ marginBottom: "1rem" }}>
                {suggestions.altar.map((s) => {
                  const name = attendees.find((a) => a.deaconId === s.deaconId)?.name;
                  if (!name) return null;
                  return (
                    <button
                      key={s.deaconId}
                      type="button"
                      className="chip chip-suggested"
                      onClick={() => handleToggleAltar(altarActivity.id, s.deaconId)}
                    >
                      {name} ({Math.round(s.percent * 100)}%)
                    </button>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginBottom: "1rem" }} />
            </>
          )}
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
        <div className="card">
          <div className="step-header">4 · Readings</div>
          {suggestions.readings.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Suggested (lowest readings % over the last {suggestions.windowMonths} month
                {suggestions.windowMonths === 1 ? "" : "s"}, across all reading roles)
              </p>
              <div className="chip-row" style={{ marginBottom: "1.1rem" }}>
                {suggestions.readings.map((s) => {
                  const name = attendees.find((a) => a.deaconId === s.deaconId)?.name;
                  if (!name) return null;
                  return (
                    <span key={s.deaconId} className="badge badge-gold">
                      {name} ({Math.round(s.percent * 100)}%)
                    </span>
                  );
                })}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginBottom: "1.1rem" }} />
            </>
          )}
          <div className="grid-2">
            {readingActivities.map((act) => {
              const assignment = context?.assignments.find((x) => x.activityId === act.id);
              const current = assignment?.deaconIds[0] ?? "";
              return (
                <div key={act.id}>
                  <div className="step-header">{act.name}</div>
                  <SingleRosterPickerModal
                    items={attendees.map((a) => ({ id: a.deaconId, name: a.name }))}
                    selectedId={current || null}
                    onSelect={(id) => handleSetReading(act.id, id ?? "")}
                    title={`${act.name} — choose a deacon`}
                    idPrefix={`reading-${act.id}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showMore} onClose={() => setShowMore(false)} title="Full roster" wide>
        <RosterPicker
          items={allRosterSorted.map((d) => ({ id: d.id, name: d.name }))}
          selectedIds={attendeeIds}
          onToggle={handleToggleAttendance}
          idPrefix="fullroster"
        />
      </Modal>
    </div>
  );
}
