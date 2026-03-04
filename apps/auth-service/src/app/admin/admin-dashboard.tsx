"use client";

import Link from "next/link";
import { UserStatus } from "@prisma/client";
import { useMemo, useState } from "react";

import type { AdminServiceDTO, AdminServiceSuggestionDTO, UserDTO } from "@/types/auth";

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
  initialServices: AdminServiceDTO[];
};

type ApiError = {
  message?: string;
};

type ServiceDraft = {
  origin: string;
  displayName: string;
  serviceKey: string;
  iconUrl: string;
  consentSummary: string;
};

const DEFAULT_CONSENT_SUMMARY = "该服务将使用你的统一账号登录状态并读取基础资料。";

function toLocalTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function createEmptyServiceDraft(): ServiceDraft {
  return {
    origin: "",
    displayName: "",
    serviceKey: "",
    iconUrl: "",
    consentSummary: DEFAULT_CONSENT_SUMMARY
  };
}

function draftFromSuggestion(input: AdminServiceSuggestionDTO): ServiceDraft {
  return {
    origin: input.origin,
    displayName: input.displayName,
    serviceKey: input.serviceKey,
    iconUrl: input.iconUrl ?? "",
    consentSummary: input.consentSummary
  };
}

function draftFromService(input: AdminServiceDTO): ServiceDraft {
  return {
    origin: input.origin,
    displayName: input.displayName,
    serviceKey: input.serviceKey,
    iconUrl: input.iconUrl ?? "",
    consentSummary: input.consentSummary
  };
}

function ServiceIconPreview({ iconUrl, label }: { iconUrl: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (label.trim().slice(0, 1) || "?").toUpperCase();

  if (!iconUrl || failed) {
    return (
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e2e8f0",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 700
        }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={`${label} icon`}
      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid #cbd5e1" }}
      onError={() => setFailed(true)}
    />
  );
}

export function AdminDashboard({ initialUsers, initialLogs, initialServices }: Props) {
  const [users, setUsers] = useState<UserDTO[]>(initialUsers);
  const [logs, setLogs] = useState<EmailCodeLog[]>(initialLogs);
  const [services, setServices] = useState<AdminServiceDTO[]>(initialServices);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [suggestReturnTo, setSuggestReturnTo] = useState("");
  const [suggestion, setSuggestion] = useState<AdminServiceSuggestionDTO | null>(null);
  const [allowlistSuggestions, setAllowlistSuggestions] = useState<AdminServiceSuggestionDTO[]>([]);

  const [draft, setDraft] = useState<ServiceDraft>(createEmptyServiceDraft());
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const editingService = useMemo(
    () => services.find((service) => service.id === editingServiceId) ?? null,
    [services, editingServiceId]
  );

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

  async function fetchServices(search?: string) {
    const url = search ? `/api/admin/services?q=${encodeURIComponent(search)}` : "/api/admin/services";
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | {
          services?: AdminServiceDTO[];
          message?: string;
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.message ?? "Unable to load services.");
    }

    setServices(payload?.services ?? []);
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

  async function onSearchServices(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      await fetchServices(serviceQuery.trim());
      setServiceMessage("Service list updated.");
    } catch (serviceSearchError) {
      setServiceError(serviceSearchError instanceof Error ? serviceSearchError.message : "Service search failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  async function suggestFromReturnTo() {
    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      const response = await fetch("/api/admin/services/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ return_to: suggestReturnTo.trim() })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            suggestion?: AdminServiceSuggestionDTO;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.suggestion) {
        throw new Error(payload?.message ?? "Unable to generate service suggestion.");
      }

      setSuggestion(payload.suggestion);
      setDraft(draftFromSuggestion(payload.suggestion));
      setEditingServiceId(payload.suggestion.existingService?.id ?? null);
      setServiceMessage(payload.suggestion.existingService ? "Matched existing service by origin." : "Suggestion generated.");
    } catch (suggestError) {
      setServiceError(suggestError instanceof Error ? suggestError.message : "Suggest failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  async function suggestFromAllowlist() {
    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      const response = await fetch("/api/admin/services/suggest-from-allowlist", {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            suggestions?: AdminServiceSuggestionDTO[];
            message?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Unable to list allowlist suggestions.");
      }

      setAllowlistSuggestions(payload?.suggestions ?? []);
      setServiceMessage(`Loaded ${payload?.suggestions?.length ?? 0} allowlist suggestions.`);
    } catch (allowlistError) {
      setServiceError(allowlistError instanceof Error ? allowlistError.message : "Allowlist suggest failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  async function createServiceFromDraft() {
    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      const response = await fetch("/api/admin/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          origin: draft.origin,
          displayName: draft.displayName || undefined,
          serviceKey: draft.serviceKey || undefined,
          iconUrl: draft.iconUrl,
          consentSummary: draft.consentSummary || undefined,
          enabled: true
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            service?: AdminServiceDTO;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.service) {
        throw new Error(payload?.message ?? "Unable to create service.");
      }

      await fetchServices(serviceQuery.trim());
      setEditingServiceId(payload.service.id);
      setSuggestion(null);
      setServiceMessage("Service created.");
    } catch (createError) {
      setServiceError(createError instanceof Error ? createError.message : "Create service failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  async function updateService() {
    if (!editingServiceId) {
      return;
    }

    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      const response = await fetch(`/api/admin/services/${editingServiceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          origin: draft.origin || undefined,
          displayName: draft.displayName || undefined,
          iconUrl: draft.iconUrl,
          consentSummary: draft.consentSummary || undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            service?: AdminServiceDTO;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.service) {
        throw new Error(payload?.message ?? "Unable to update service.");
      }

      await fetchServices(serviceQuery.trim());
      setServiceMessage("Service updated.");
    } catch (updateError) {
      setServiceError(updateError instanceof Error ? updateError.message : "Update service failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  async function toggleService(service: AdminServiceDTO) {
    setServiceBusy(true);
    setServiceError(null);
    setServiceMessage(null);

    try {
      const response = await fetch(`/api/admin/services/${service.id}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled: !service.enabled })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            service?: AdminServiceDTO;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.service) {
        throw new Error(payload?.message ?? "Unable to toggle service.");
      }

      await fetchServices(serviceQuery.trim());
      setServiceMessage(`Service ${payload.service.enabled ? "enabled" : "disabled"}.`);
    } catch (toggleError) {
      setServiceError(toggleError instanceof Error ? toggleError.message : "Toggle service failed.");
    } finally {
      setServiceBusy(false);
    }
  }

  function startEditService(service: AdminServiceDTO) {
    setEditingServiceId(service.id);
    setSuggestion(null);
    setDraft(draftFromService(service));
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
        <h2>Connected Services</h2>

        <form onSubmit={onSearchServices} className="inline-actions" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <input
            placeholder="Search services by name/key/domain"
            value={serviceQuery}
            onChange={(event) => setServiceQuery(event.target.value)}
            style={{ minWidth: 260, maxWidth: 380 }}
          />
          <button type="submit" disabled={serviceBusy}>
            {serviceBusy ? "Loading..." : "Search Services"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={serviceBusy}
            onClick={async () => {
              setServiceQuery("");
              setServiceBusy(true);
              setServiceError(null);
              setServiceMessage(null);
              try {
                await fetchServices();
              } finally {
                setServiceBusy(false);
              }
            }}
          >
            Reset
          </button>
        </form>

        <div className="inline-actions" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          <input
            placeholder="Paste return_to URL to generate suggestion"
            value={suggestReturnTo}
            onChange={(event) => setSuggestReturnTo(event.target.value)}
            style={{ minWidth: 320, flex: 1 }}
          />
          <button type="button" disabled={serviceBusy || !suggestReturnTo.trim()} onClick={suggestFromReturnTo}>
            Suggest by URL
          </button>
          <button type="button" className="secondary" disabled={serviceBusy} onClick={suggestFromAllowlist}>
            Suggest from allowlist
          </button>
        </div>

        {allowlistSuggestions.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <small>Allowlist suggestions</small>
            <table style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Origin</th>
                  <th>Suggested Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {allowlistSuggestions.map((item) => (
                  <tr key={item.origin}>
                    <td>{item.origin}</td>
                    <td>{item.displayName}</td>
                    <td>{item.existingService ? "Already created" : "Ready"}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        disabled={serviceBusy}
                        onClick={() => {
                          setSuggestion(item);
                          setEditingServiceId(item.existingService?.id ?? null);
                          setDraft(draftFromSuggestion(item));
                        }}
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {serviceMessage ? <p><small>{serviceMessage}</small></p> : null}
        {serviceError ? <p style={{ color: "#b91c1c" }}><small>{serviceError}</small></p> : null}

        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
            background: "#f8fafc"
          }}
        >
          <h3 style={{ marginTop: 0 }}>{editingService ? "Edit Service" : "Create Service"}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <small>Display Name</small>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="AI Todo"
              />
            </label>
            <label>
              <small>Service Key {editingService ? "(read-only)" : "(optional)"}</small>
              <input
                value={draft.serviceKey}
                onChange={(event) => setDraft((prev) => ({ ...prev, serviceKey: event.target.value }))}
                placeholder="svc-ai-todo"
                disabled={Boolean(editingService)}
              />
            </label>
            <label>
              <small>Origin</small>
              <input
                value={draft.origin}
                onChange={(event) => setDraft((prev) => ({ ...prev, origin: event.target.value }))}
                placeholder="https://your-app.vercel.app"
              />
            </label>
            <label>
              <small>Icon URL (leave empty to use favicon)</small>
              <input
                value={draft.iconUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, iconUrl: event.target.value }))}
                placeholder="https://your-app.vercel.app/favicon.ico"
              />
            </label>
            <label>
              <small>Consent Summary</small>
              <textarea
                value={draft.consentSummary}
                onChange={(event) => setDraft((prev) => ({ ...prev, consentSummary: event.target.value }))}
                rows={3}
                style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px" }}
              />
            </label>
          </div>

          <div className="inline-actions" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {editingService ? (
              <button type="button" disabled={serviceBusy} onClick={updateService}>
                Save Service
              </button>
            ) : (
              <button type="button" disabled={serviceBusy || !draft.origin.trim()} onClick={createServiceFromDraft}>
                Create Service
              </button>
            )}
            <button
              type="button"
              className="secondary"
              disabled={serviceBusy}
              onClick={() => {
                setEditingServiceId(null);
                setSuggestion(null);
                setDraft(createEmptyServiceDraft());
              }}
            >
              Clear Draft
            </button>
            {suggestion ? (
              <small>
                Suggestion source: {suggestion.origin} {suggestion.existingService ? "(already exists)" : "(new)"}
              </small>
            ) : null}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Service Key</th>
              <th>Origin</th>
              <th>Status</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <ServiceIconPreview iconUrl={service.iconUrl} label={service.displayName} />
                </td>
                <td>
                  <strong>{service.displayName}</strong>
                  <br />
                  <small>{service.hostname}</small>
                </td>
                <td>{service.serviceKey}</td>
                <td>{service.origin}</td>
                <td>
                  <span className={`badge ${service.enabled ? "active" : "disabled"}`}>
                    {service.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                </td>
                <td>{toLocalTime(service.updatedAt)}</td>
                <td>
                  <div className="inline-actions" style={{ flexWrap: "wrap" }}>
                    <button type="button" className="secondary" disabled={serviceBusy} onClick={() => startEditService(service)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={service.enabled ? "danger" : "secondary"}
                      disabled={serviceBusy}
                      onClick={() => toggleService(service)}
                    >
                      {service.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 ? (
              <tr>
                <td colSpan={7}>No services found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
