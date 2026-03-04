import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApproveConsentForm } from "@/app/authorize/approve-consent-form";
import { ServiceIcon } from "@/app/authorize/service-icon";
import styles from "@/app/authorize/authorize.module.css";
import { buildAuthorizeCallback, buildLoginRedirectPath, parseAuthorizeRequest } from "@/server/auth/authorize";
import { AuthError } from "@/server/auth/errors";
import { getCurrentUserFromAccessToken, hasServiceConsent } from "@/server/auth/service";
import { readAccessFromCookieHeader } from "@/server/auth/token-cookie";

type SearchParams = Record<string, string | string[] | undefined>;

type AuthorizePageProps = {
  searchParams: Promise<SearchParams>;
};

const AUTH_TOKEN_ERROR_NAMES = new Set([
  "JOSEError",
  "JWTExpired",
  "JWTInvalid",
  "JWTClaimValidationFailed",
  "JWSInvalid",
  "JWSSignatureVerificationFailed"
]);

function hasAuthTokenErrorCode(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode !== "string") {
    return false;
  }

  return (
    maybeCode.startsWith("ERR_JWT_") ||
    maybeCode.startsWith("ERR_JWS_") ||
    maybeCode.startsWith("ERR_JWKS_")
  );
}

function isAuthFailure(error: unknown): boolean {
  if (error instanceof AuthError) {
    return true;
  }

  if (error instanceof Error && AUTH_TOKEN_ERROR_NAMES.has(error.name)) {
    return true;
  }

  return hasAuthTokenErrorCode(error);
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams;

  let authorizeRequest;
  try {
    authorizeRequest = await parseAuthorizeRequest({
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
              请检查 `return_to`、`state` 参数，并确认回跳域名已在后台 Services 启用，或返回{" "}
              <Link href="/login">登录页</Link>。
            </p>
          </div>
        </section>
      </main>
    );
  }

  const requestHeaders = await headers();
  const accessToken = readAccessFromCookieHeader(requestHeaders.get("cookie") ?? "");

  if (!accessToken) {
    redirect(buildLoginRedirectPath(authorizeRequest) as Route);
  }

  let currentUser;
  try {
    currentUser = await getCurrentUserFromAccessToken(accessToken);
  } catch (error) {
    if (isAuthFailure(error)) {
      redirect(buildLoginRedirectPath(authorizeRequest) as Route);
    }

    console.error("[authorize] Failed to load current user", error);
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.panel}>
            <p className={styles.kicker}>统一授权</p>
            <h1 className={styles.title}>暂时无法完成授权</h1>
            <p className={styles.summary}>登录态校验失败，请稍后再试。</p>
            <p className={styles.note}>
              你可以返回{" "}
              <Link href={buildLoginRedirectPath(authorizeRequest) as Route}>登录页</Link>{" "}
              重新发起授权。
            </p>
          </div>
        </section>
      </main>
    );
  }

  let consentGranted = false;
  try {
    consentGranted = await hasServiceConsent({
      userId: currentUser.id,
      serviceId: authorizeRequest.serviceId
    });
  } catch (error) {
    console.error("[authorize] Failed to query consent", error);
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.panel}>
            <p className={styles.kicker}>统一授权</p>
            <h1 className={styles.title}>授权服务暂时不可用</h1>
            <p className={styles.summary}>无法读取授权状态，请稍后再试。</p>
            <p className={styles.note}>
              登录态已保留。你可以稍后刷新本页，或返回{" "}
              <Link href={buildLoginRedirectPath(authorizeRequest) as Route}>登录页</Link>{" "}
              重试。
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (consentGranted) {
    redirect(buildAuthorizeCallback(authorizeRequest.returnTo, authorizeRequest.state) as Route);
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <p className={styles.kicker}>统一授权</p>
          <div className={styles.serviceHeader}>
            <ServiceIcon serviceName={authorizeRequest.serviceName} iconUrl={authorizeRequest.serviceIconUrl} />
            <h1 className={styles.title}>授权 {authorizeRequest.serviceName}</h1>
          </div>
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
