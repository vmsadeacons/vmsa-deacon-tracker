"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ByLiturgyTab from "./reports/ByLiturgyTab";
import ByDeaconTab from "./reports/ByDeaconTab";
import SummaryTab from "./reports/SummaryTab";
import PassionWeekReportTab from "./reports/PassionWeekReportTab";
import type { LocationRow } from "@/lib/repo/locations";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { PWActivityRow } from "@/lib/repo/passionWeekActivities";
import type { RankRow } from "@/lib/repo/ranks";
import type { DayFilterOptionRow } from "@/lib/repo/dayFilterOptions";
import type { ServiceTypeCode } from "@/lib/constants";

type Tab = "by-liturgy" | "by-deacon" | "summary" | "passion-week";

const TABS: { id: Tab; label: string }[] = [
  { id: "by-liturgy", label: "By Liturgy" },
  { id: "by-deacon", label: "By Deacon" },
  { id: "summary", label: "Summary" },
  { id: "passion-week", label: "Passion Week" },
];

export default function ReportsClient({
  locations,
  deacons,
  defaultDate,
  defaultLocationId,
  defaultServiceType,
  currentYear,
  pwActivities,
  ranks,
  dayFilterOptions,
}: {
  locations: LocationRow[];
  deacons: DeaconWithAgeGroup[];
  defaultDate: string;
  defaultLocationId: string;
  defaultServiceType: ServiceTypeCode;
  currentYear: number;
  pwActivities: PWActivityRow[];
  ranks: RankRow[];
  dayFilterOptions: DayFilterOptionRow[];
}) {
  const pwLabels = Object.fromEntries(pwActivities.map((a) => [a.code, a.label]));
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) ?? "by-liturgy";
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? initialTab : "by-liturgy");

  const prefillDate = searchParams.get("date") ?? defaultDate;
  const prefillLocationId = searchParams.get("locationId") ?? defaultLocationId;
  const prefillService = (searchParams.get("service") as ServiceTypeCode) || defaultServiceType;

  return (
    <div>
      <h1>Reports & Analytics</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "by-liturgy" && (
        <ByLiturgyTab
          locations={locations}
          initialDate={prefillDate}
          initialLocationId={prefillLocationId}
          initialServiceType={prefillService}
        />
      )}
      {tab === "by-deacon" && <ByDeaconTab deacons={deacons} pwLabels={pwLabels} />}
      {tab === "summary" && (
        <SummaryTab locations={locations} ranks={ranks} dayFilterOptions={dayFilterOptions} />
      )}
      {tab === "passion-week" && (
        <PassionWeekReportTab locations={locations} initialYear={currentYear} pwActivities={pwActivities} />
      )}
    </div>
  );
}
