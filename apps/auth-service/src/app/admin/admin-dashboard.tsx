"use client";

import Link from "next/link";
import { UserStatus } from "@prisma/client";
import { useState } from "react";

import type { UserDTO } from "@/types/auth";

type EmailCodeLog = {
  requestId: string;
  email: string;
  purpose: string;
  attemptCount: number;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

type Props = {
  initialUsers: UserDTO[];
  initialLogs: EmailCodeLog[];
};

type ApiError = {
  message?: string;
};

function toLocalTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function AdminDashboard({ initialUsers, initialLogs }: Props) {
  const [users, setUsers] = useState<UserDTO[]>(initialUsers);
  const [logs, setLogs] = useState<EmailCodeLog[]>(initialLogs);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchUsers(search?: string) {
    const url = search ? `/api/admin/users?q=${encodeURIComponent(search)}` : "/api/admin/users";
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | {
          users?: UserDTO[];
          message?: string;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "Unable to load users.");
    }

    setUsers(payload?.users ?? []);
  }

  async function fetchLogs() {
    const response = await fetch("/api/admin/email-codes?limit=25", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | {
          logs?: EmailCodeLog[];
          message?: string;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "Unable to load logs.");
    }

    setLogs(payload?.logs ?? []);
  }

  async function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await fetchUsers(query.trim());
      setMessage("User list updated.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(userId: string, status: UserStatus) {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      const payload = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to update user status.");
      }

      await Promise.all([fetchUsers(query.trim()), fetchLogs()]);
      setMessage(`User status updated to ${status}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-grid">
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <form onSubmit={onSearch} className="inline-actions" style={{ flex: 1 }}>
            <input
              placeholder="Search users by email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ maxWidth: 360 }}
            />
            <button type="submit" disabled={busy}>
              {busy ? "Loading..." : "Search"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                setQuery("");
                setBusy(true);
                setError(null);
                setMessage(null);
                try {
                  await fetchUsers();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Reset
            </button>
          </form>
          <button type="button" className="danger" onClick={logout} disabled={busy}>
            Logout
          </button>
        </div>

        {message ? <p><small>{message}</small></p> : null}
        {error ? <p style={{ color: "#b91c1c" }}><small>{error}</small></p> : null}
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Users</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link href={`/admin/users/${user.id}`}>{user.email}</Link>
                </td>
                <td>
                  <span className={`badge ${user.status === UserStatus.ACTIVE ? "active" : "disabled"}`}>
                    {user.status}
                  </span>
                </td>
                <td>{toLocalTime(user.lastLoginAt)}</td>
                <td>
                  {user.status === UserStatus.ACTIVE ? (
                    <button type="button" className="danger" disabled={busy} onClick={() => updateStatus(user.id, UserStatus.DISABLED)}>
                      Disable
                    </button>
                  ) : (
                    <button type="button" className="secondary" disabled={busy} onClick={() => updateStatus(user.id, UserStatus.ACTIVE)}>
                      Enable
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4}>No users found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Recent Verification Code Logs</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Purpose</th>
              <th>Attempts</th>
              <th>Created At</th>
              <th>Consumed At</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.requestId}>
                <td>{log.email}</td>
                <td>{log.purpose}</td>
                <td>{log.attemptCount}</td>
                <td>{toLocalTime(log.createdAt)}</td>
                <td>{toLocalTime(log.consumedAt)}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5}>No logs found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
