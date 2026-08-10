"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArchiveLogRow } from "@/lib/repo/archive";
import { previewArchiveAction, runArchiveAction } from "@/app/(app)/archive/actions";

const CUTOFFS = [
  { months: 1, label: "1 month" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 36, label: "36 months" },
] as const;

export default function ArchiveClient({ runs, canEdit }: { runs: ArchiveLogRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [months, setMonths] = useState<1 | 6 | 12 | 36>(6);
  const [preview, setPreview] = useState<{ cutoffDate: string; liturgiesToMove: number; participationToMove: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function handlePreview(m: 1 | 6 | 12 | 36) {
    setMonths(m);
    setLoading(true);
    const result = await previewArchiveAction(m);
    setPreview(result);
    setLoading(false);
  }

  async function handleRun() {
    if (!preview) return;
    if (
      !confirm(
        `Move ${preview.liturgiesToMove} liturgies and ${preview.participationToMove} participation records older than ${preview.cutoffDate} to the archive?`
      )
    )
      return;
    setRunning(true);
    await runArchiveAction(months);
    setRunning(false);
    setPreview(null);
    router.refresh();
  }

  return (
    <div>
      <h1>Archive</h1>
      <div className="card">
        <h3>Move old records to the archive</h3>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Archived data always stays visible in My History and Reports — it just moves out of the live editing screens.
        </p>
        <div className="chip-row" style={{ marginBottom: "1rem" }}>
          {CUTOFFS.map((c) => (
            <button
              key={c.months}
              type="button"
              className={`chip ${months === c.months ? "active" : ""}`}
              onClick={() => handlePreview(c.months)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {loading && <p className="muted">Calculating…</p>}
        {preview && !loading && (
          <div style={{ marginBottom: "1rem" }}>
            <p>
              Cutoff date: <strong>{preview.cutoffDate}</strong>
            </p>
            <p>
              {preview.liturgiesToMove} liturgies and {preview.participationToMove} participation records would move.
            </p>
          </div>
        )}
        <button
          className="btn btn-primary"
          disabled={!canEdit || !preview || preview.liturgiesToMove === 0 || running}
          onClick={handleRun}
        >
          {running ? "Archiving…" : "Preview & archive"}
        </button>
        {!canEdit && (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Only a System Admin can run the archive. You can still preview cutoffs and view history below.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Archive history</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Run at</th>
                <th>Cutoff date</th>
                <th>Liturgies moved</th>
                <th>Participation moved</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.run_at).toLocaleString()}</td>
                  <td>{r.cutoff_date}</td>
                  <td>{r.liturgies_moved}</td>
                  <td>{r.participation_moved}</td>
                  <td>{r.by_user_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
