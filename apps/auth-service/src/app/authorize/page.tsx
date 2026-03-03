import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApproveConsentForm } from "@/app/authorize/approve-consent-form";
import styles from "@/app/authorize/authorize.module.css";
import { buildAuthorizeCallback, buildLoginRedirectPath, parseAuthorizeRequest } from "@/server/auth/authorize";
import { authCookieNames } from "@/server/auth/cookies";
import { AuthError } from "@/server/auth/errors";
import { getCurrentUserFromAccessToken, hasServiceConsent } from "@/server/auth/service";

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
    const message = error instanceof AuthError ? error.message : "Invalid authorize request.";
    return (
      <main className={styles.shell}>
        <section className={styles.panel}>
          <p className={styles.kicker}>Authorization</p>
          <h1 className={styles.title}>Request rejected</h1>
          <p className={styles.summary}>{message}</p>
          <p className={styles.note}>
            Check `service`, `return_to`, and `state` query params, or return to <Link href="/login">login</Link>.
          </p>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(authCookieNames.access)?.value;

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
    <main className={styles.shell}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Authorization</p>
        <h1 className={styles.title}>Authorize {authorizeRequest.serviceName}</h1>
        <p className={styles.summary}>{authorizeRequest.consentSummary}</p>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span className={styles.label}>Service ID</span>
            <p className={styles.value}>{authorizeRequest.serviceId}</p>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.label}>Return URL</span>
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
            Switch account
          </Link>
        </div>

        <p className={styles.note}>
          After authorization, you will be redirected back to the service and it can read your session from shared
          auth cookies.
        </p>
      </section>
    </main>
  );
}
