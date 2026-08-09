"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "./Modal";
import DeaconForm from "./DeaconForm";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { LocationRow } from "@/lib/repo/locations";
import type { DeaconInput } from "@/lib/repo/deacons";
import { createDeaconAction, updateDeaconAction, deleteDeaconAction } from "@/app/(app)/deacons/actions";

type SortKey = "name" | "city" | "age_group" | "rank" | "status";

export default function DeaconsClient({
  deacons,
  locations,
}: {
  deacons: DeaconWithAgeGroup[];
  locations: LocationRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [editing, setEditing] = useState<DeaconWithAgeGroup | null>(null);
  const [adding, setAdding] = useState(searchParams.get("add") === "1");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...deacons];
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      return av.localeCompare(bv) * sortDir;
    });
    return copy;
  }, [deacons, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === 1 ? " ▲" : " ▼";
  }

  async function handleCreate(input: DeaconInput) {
    setError(null);
    const result = await createDeaconAction(input);
    if (result.ok) {
      setAdding(false);
      router.replace("/deacons");
      router.refresh();
    }
  }

  async function handleUpdate(input: DeaconInput) {
    if (!editing) return;
    setError(null);
    const result = await updateDeaconAction(editing.id, input);
    if (result.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function handleDelete(deacon: DeaconWithAgeGroup) {
    if (!confirm(`Permanently delete ${deacon.name}? This can't be undone.`)) return;
    const result = await deleteDeaconAction(deacon.id);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    router.refresh();
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "age_group", label: "Age group" },
    { key: "rank", label: "Rank" },
    { key: "status", label: "Status" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Deacons</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add deacon
        </button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: "1rem" }}>{error}</p>}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="sortable" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    {sortIndicator(col.key)}
                  </th>
                ))}
                <th>Phone</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.city ?? "—"}</td>
                  <td>{d.age_group ?? "—"}</td>
                  <td>{d.rank}</td>
                  <td>
                    <span className={`badge ${d.status === "Active" ? "badge-green" : "badge-grey"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td>{d.phone ?? "—"}</td>
                  <td>{d.email ?? "—"}</td>
                  <td style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(d)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add deacon" wide>
        <DeaconForm initial={null} locations={locations} onCancel={() => setAdding(false)} onSave={handleCreate} />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit deacon" wide>
        {editing && (
          <DeaconForm initial={editing} locations={locations} onCancel={() => setEditing(null)} onSave={handleUpdate} />
        )}
      </Modal>
    </div>
  );
}
