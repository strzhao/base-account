import { headers } from "next/headers";
import { redirect } from "next/navigation";

import styles from "@/app/authorize/authorize.module.css";
import { CliAuthForm } from "@/app/cli-auth/cli-auth-form";
import { getCurrentUserFromAccessToken } from "@/server/auth/service";
import { readAccessFromCookieHeader } from "@/server/auth/token-cookie";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CliAuthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : "";
  const port = typeof params.port === "string" ? params.port : "";

  if (!state || !port) {
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.panel}>
            <p className={styles.kicker}>CLI 授权</p>
            <h1 className={styles.title}>参数缺失</h1>
            <p className={styles.summary}>请通过 <code>ba login</code> 命令发起授权。</p>
          </div>
        </section>
      </main>
    );
  }

  const requestHeaders = await headers();
  const accessToken = readAccessFromCookieHeader(requestHeaders.get("cookie") ?? "");

  if (!accessToken) {
    const returnTo = `/cli-auth?state=${encodeURIComponent(state)}&port=${encodeURIComponent(port)}`;
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  let userEmail: string;
  try {
    const user = await getCurrentUserFromAccessToken(accessToken);
    userEmail = user.email;
  } catch {
    const returnTo = `/cli-auth?state=${encodeURIComponent(state)}&port=${encodeURIComponent(port)}`;
    redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <p className={styles.kicker}>CLI 授权</p>
          <h1 className={styles.title}>授权 CLI 工具</h1>
          <p className={styles.summary}>
            CLI 工具请求以 <strong>{userEmail}</strong> 的身份访问你的账号。
          </p>

          <CliAuthForm state={state} port={port} />

          <p className={styles.note}>
            授权后 CLI 将获得操作权限。如非本人发起，请关闭此页面。
          </p>
        </div>
      </section>
    </main>
  );
}
