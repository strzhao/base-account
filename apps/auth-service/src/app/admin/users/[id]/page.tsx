import Link from "next/link";

import { requireAdminFromCookies } from "@/server/auth/admin-session";
import { getUserDetailForAdmin } from "@/server/auth/service";

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toLocalTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await requireAdminFromCookies();
  const { id } = await params;

  const detail = await getUserDetailForAdmin(id);

  return (
    <main className="page-shell">
      <section className="panel" style={{ marginBottom: 16 }}>
        <h1>User Detail</h1>
        <p>
          <strong>{detail.user.email}</strong> · <span>{detail.user.status}</span>
        </p>
        <p>
          <small>Created: {toLocalTime(detail.user.createdAt)}</small>
        </p>
        <p>
          <Link href="/admin">Back to admin</Link>
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Sessions</h2>
        <table>
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Revoked</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {detail.sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.id}</td>
                <td>{toLocalTime(session.createdAt)}</td>
                <td>{toLocalTime(session.expiresAt)}</td>
                <td>{toLocalTime(session.revokedAt)}</td>
                <td>{session.ip ?? "-"}</td>
              </tr>
            ))}
            {detail.sessions.length === 0 ? (
              <tr>
                <td colSpan={5}>No sessions found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Audit Logs</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Target Type</th>
              <th>At</th>
            </tr>
          </thead>
          <tbody>
            {detail.auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>
                  {log.actorType}
                  {log.actorId ? ` (${log.actorId})` : ""}
                </td>
                <td>{log.targetType}</td>
                <td>{toLocalTime(log.createdAt)}</td>
              </tr>
            ))}
            {detail.auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4}>No audit logs found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
