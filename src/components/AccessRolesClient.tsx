"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import UserForm from "./UserForm";
import type { UserWithPerson } from "@/lib/repo/users";
import type { DeaconWithAgeGroup } from "@/lib/repo/deacons";
import type { Role } from "@/lib/constants";
import {
  grantAccessAction,
  updateUserAction,
  setUserPinAction,
  setUserStatusAction,
  deleteUserAction,
} from "@/app/(app)/access/actions";

function canModify(actorRole: Role, target: UserWithPerson): boolean {
  if (target.is_primary_admin) return false;
  if (target.role === "SystemAdmin" && actorRole !== "SystemAdmin") return false;
  return true;
}

export default function AccessRolesClient({
  users,
  deacons,
  actorRole,
}: {
  users: UserWithPerson[];
  deacons: DeaconWithAgeGroup[];
  actorRole: Role;
}) {
  const router = useRouter();
  const [granting, setGranting] = useState(false);
  const [editing, setEditing] = useState<UserWithPerson | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGrant(input: Parameters<typeof grantAccessAction>[0]) {
    const result = await grantAccessAction(input);
    if (!result.ok) throw new Error(result.error);
    setGranting(false);
    router.refresh();
  }

  async function handleEdit(input: {
    email: string;
    name: string | null;
    role: Role;
    linkedDeaconId: string | null;
    pin: string | null;
  }) {
    if (!editing) return;
    const result = await updateUserAction(editing.id, input);
    if (!result.ok) throw new Error(result.error);
    setEditing(null);
    router.refresh();
  }

  async function handleResetPin(u: UserWithPerson) {
    const pin = prompt(`New PIN for ${u.person_name}:`);
    if (!pin) return;
    const result = await setUserPinAction(u.id, pin);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleToggleStatus(u: UserWithPerson) {
    const next = u.status === "Active" ? "Disabled" : "Active";
    const result = await setUserStatusAction(u.id, next);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleDelete(u: UserWithPerson) {
    if (!confirm(`Remove login access for ${u.person_name}?`)) return;
    const result = await deleteUserAction(u.id);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Access & Roles</h1>
        <button className="btn btn-primary" onClick={() => setGranting(true)}>
          Grant access
        </button>
      </div>

      {error && <p className="error-text" style={{ marginBottom: "1rem" }}>{error}</p>}

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Sign-in</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const modifiable = canModify(actorRole, u);
                return (
                  <tr key={u.id}>
                    <td>{u.person_name}</td>
                    <td>
                      {u.role === "Deacon" ? `Email + PIN (${u.email})` : `Google (${u.email})`}
                    </td>
                    <td>
                      <span className="badge badge-wine">{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === "Active" ? "badge-green" : "badge-grey"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {u.role === "Deacon" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={!modifiable}
                          onClick={() => handleResetPin(u)}
                        >
                          Reset PIN
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!modifiable}
                        onClick={() => setEditing(u)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!modifiable}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.status === "Active" ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!modifiable}
                        onClick={() => handleDelete(u)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={granting} onClose={() => setGranting(false)} title="Grant access">
        <UserForm
          initial={null}
          deacons={deacons}
          actorIsSystemAdmin={actorRole === "SystemAdmin"}
          onCancel={() => setGranting(false)}
          onSave={handleGrant}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit access">
        {editing && (
          <UserForm
            initial={editing}
            deacons={deacons}
            actorIsSystemAdmin={actorRole === "SystemAdmin"}
            onCancel={() => setEditing(null)}
            onSave={handleEdit}
          />
        )}
      </Modal>
    </div>
  );
}
