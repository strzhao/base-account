import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApproveConsentForm } from "@/app/authorize/approve-consent-form";
import styles from "@/app/authorize/authorize.module.css";
import { buildAuthorizeCallback, buildLoginRedirectPath, parseAuthorizeRequest } from "@/server/auth/authorize";
import { AuthError } from "@/server/auth/errors";
import { getCurrentUserFromAccessToken, hasServiceConsent } from "@/server/auth/service";
import { readAccessFromCookieStore } from "@/server/auth/token-cookie";

type SearchParams = Record<string, string | string[] | undefined>;

type AuthorizePageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams;

  let authorizeRequest;
  try {
    authorizeRequest = parseAuthorizeRequest({
      service: params.service,
      return_to: params.return_to,
      state: params.state
    });
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "授权请求参数无效。";
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.panel}>
            <p className={styles.kicker}>统一授权</p>
            <h1 className={styles.title}>请求已拦截</h1>
            <p className={styles.summary}>{message}</p>
            <p className={styles.note}>
              请检查 `service`、`return_to`、`state` 参数，或返回 <Link href="/login">登录页</Link>。
            </p>
          </div>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  const accessToken = readAccessFromCookieStore(cookieStore);

  if (!accessToken) {
    redirect(buildLoginRedirectPath(authorizeRequest) as Route);
  }

  try {
    const user = await getCurrentUserFromAccessToken(accessToken);
    const consentGranted = await hasServiceConsent({
      userId: user.id,
      serviceId: authorizeRequest.serviceId
    });

    if (consentGranted) {
      redirect(buildAuthorizeCallback(authorizeRequest.returnTo, authorizeRequest.state) as Route);
    }
  } catch {
    redirect(buildLoginRedirectPath(authorizeRequest) as Route);
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <p className={styles.kicker}>统一授权</p>
          <h1 className={styles.title}>授权 {authorizeRequest.serviceName}</h1>
          <p className={styles.summary}>{authorizeRequest.consentSummary}</p>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.label}>服务标识</span>
              <p className={styles.value}>{authorizeRequest.serviceId}</p>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.label}>回跳地址</span>
              <p className={styles.value}>{authorizeRequest.returnTo}</p>
            </div>
          </div>

          <div className={styles.actions}>
            <ApproveConsentForm
              serviceId={authorizeRequest.serviceId}
              returnTo={authorizeRequest.returnTo}
              state={authorizeRequest.state}
            />
            <Link href={buildLoginRedirectPath(authorizeRequest) as Route} className={styles.secondaryLink}>
              切换账号
            </Link>
          </div>

          <p className={styles.note}>授权成功后将回到目标服务，服务端可通过共享 Cookie 获取登录态。</p>
        </div>
      </section>
    </main>
  );
}
