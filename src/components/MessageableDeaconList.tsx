"use client";

import { useState } from "react";
import type { DeaconContact } from "@/lib/repo/dashboard";
import { formatPhone, telHref, smsHref } from "@/lib/formatPhone";

const DEFAULT_TEMPLATE =
  "Dear $$Name$$, we've missed you at liturgy these past few weeks. Hope to see you soon.";

/** Used for both the Dashboard's Active and Absent deacon lists — a plain
 * contact table with select + bulk-personalized-text-message capability. */
export default function MessageableDeaconList({ people }: { people: DeaconContact[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  if (people.length === 0) return <p className="muted">No one matches.</p>;

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedPeople = people.filter((p) => selected[p.id]);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  // A recipient's message follows the template live, until the admin edits
  // that specific one by hand -- after that, further template edits leave
  // their customized version alone.
  function messageFor(p: DeaconContact): string {
    if (touched[p.id]) return edited[p.id] ?? "";
    return template.split("$$Name$$").join(p.first_name);
  }

  function handleEditRecipient(id: string, text: string) {
    setTouched((t) => ({ ...t, [id]: true }));
    setEdited((e) => ({ ...e, [id]: text }));
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!selected[p.id]}
                    onChange={() => toggle(p.id)}
                    style={{ width: "auto" }}
                  />
                </td>
                <td>{p.name}</td>
                <td>{p.phone ? <a href={telHref(p.phone)}>{formatPhone(p.phone)}</a> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: "1rem" }}
        disabled={selectedIds.length === 0}
        onClick={() => setComposing(true)}
      >
        Message selected ({selectedIds.length})
      </button>

      {composing && selectedIds.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div className="field">
            <label>Message template</label>
            <textarea rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} />
          </div>
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.4rem 0 1rem" }}>
            Use $$Name$$ to insert each person&apos;s first name. Edit any message below before sending
            it — that edit stays put even if you change the template afterward.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {selectedPeople.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <textarea
                  rows={2}
                  style={{ flex: 1 }}
                  value={messageFor(p)}
                  onChange={(e) => handleEditRecipient(p.id, e.target.value)}
                />
                {p.phone ? (
                  <a
                    href={smsHref(p.phone, messageFor(p))}
                    className={`btn btn-sm ${sent[p.id] ? "btn-secondary" : "btn-primary"}`}
                    style={{ flexShrink: 0, textDecoration: "none" }}
                    onClick={() => setSent((s) => ({ ...s, [p.id]: true }))}
                  >
                    {sent[p.id] ? "Sent" : `Text ${p.first_name}`}
                  </a>
                ) : (
                  <span className="muted" style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                    No phone on file
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
