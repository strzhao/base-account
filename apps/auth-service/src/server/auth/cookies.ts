import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const DEFAULT_PROD_COOKIE_DOMAIN = ".stringzhao.life";

function getCookieDomain(): string {
  const env = getEnv();
  const normalizedDomain = env.AUTH_COOKIE_DOMAIN.trim();
  return normalizedDomain || (env.NODE_ENV === "production" ? DEFAULT_PROD_COOKIE_DOMAIN : "");
}

function getCookieBaseOptions(maxAge: number, domain?: string) {
  const env = getEnv();

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {})
  };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  const env = getEnv();
  const cookieDomain = getCookieDomain();

  // Clear host-only cookies first to avoid duplicate-name ambiguity across domain scopes.
  response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });

  response.cookies.set(
    ACCESS_COOKIE,
    accessToken,
    getCookieBaseOptions(env.ACCESS_TOKEN_EXPIRES_IN_SEC, cookieDomain)
  );
  response.cookies.set(
    REFRESH_COOKIE,
    refreshToken,
    getCookieBaseOptions(env.REFRESH_TOKEN_EXPIRES_IN_SEC, cookieDomain)
  );
}

export function clearAuthCookies(response: NextResponse): void {
  const cookieDomain = getCookieDomain();

  // Clear host-only scope.
  response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });

  // Clear shared-domain scope.
  if (cookieDomain) {
    response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0, cookieDomain), maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0, cookieDomain), maxAge: 0 });
  }
}

export function readAccessCookie(request: Request): string | undefined {
  const value = request.headers.get("cookie") ?? "";
  const accessCookie = value
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ACCESS_COOKIE}=`));

  return accessCookie?.split("=")[1];
}

export const authCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE
};
