import { listEmailCodeLogsForAdmin, listUsersForAdmin } from "@/server/auth/service";
import { requireAdminFromCookies } from "@/server/auth/admin-session";
import { listAuthServicesForAdmin } from "@/server/auth/service-registry";

import { AdminDashboard } from "./admin-dashboard";

export default async function AdminPage() {
  const admin = await requireAdminFromCookies();

  const [users, logs, services] = await Promise.all([
    listUsersForAdmin(),
    listEmailCodeLogsForAdmin(25),
    listAuthServicesForAdmin()
  ]);

  return (
    <main className="page-shell">
      <section className="panel" style={{ marginBottom: 18 }}>
        <h1>Admin Console</h1>
        <p>
          Signed in as <strong>{admin.email}</strong>
        </p>
      </section>

      <AdminDashboard initialUsers={users} initialLogs={logs} initialServices={services} />
    </main>
  );
}
