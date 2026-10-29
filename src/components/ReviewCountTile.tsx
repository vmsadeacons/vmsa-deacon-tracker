"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPendingFlagCountAction } from "@/lib/actions/checkinReview";

const REFRESH_MS = 60_000;

/**
 * A small version of the Dashboard's "check-ins to review" tile for pages an
 * admin leaves open during a liturgy. The number is re-read every minute while
 * the tab is showing (and straight away when they come back to it), so a new
 * flag turns the tile amber without a reload.
 */
export default function ReviewCountTile({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const n = await getPendingFlagCountAction();
        if (!cancelled) setCount(n);
      } catch {
        // Keep showing the last number; the next tick tries again.
      }
    }
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const waiting = count > 0;
  return (
    <Link
      href="/checkin-review"
      className="stat-tile small clickable record-tile"
      style={waiting ? { background: "var(--amber-bg)" } : undefined}
    >
      <span className="stat-value" style={waiting ? { color: "var(--amber)" } : undefined}>
        {count}
      </span>
      <span className="stat-label" style={waiting ? { color: "var(--amber)", fontWeight: 600 } : undefined}>
        {count === 1 ? "check-in to review" : "check-ins to review"}
      </span>
    </Link>
  );
}
