import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const DEFAULT_PROD_COOKIE_DOMAIN = ".stringzhao.life";

function getConfiguredCookieDomain(): string {
  return getEnv().AUTH_COOKIE_DOMAIN.trim();
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

function serializeCookie(name: string, value: string, maxAge: number, domain?: string): string {
  const env = getEnv();
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAge}`, "SameSite=Lax", "HttpOnly"];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  if (env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function appendCookie(response: NextResponse, name: string, value: string, maxAge: number, domain?: string): void {
  response.headers.append("set-cookie", serializeCookie(name, value, maxAge, domain));
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  const env = getEnv();
  const configuredDomain = getConfiguredCookieDomain();

  if (configuredDomain) {
    response.cookies.set(
      ACCESS_COOKIE,
      accessToken,
      getCookieBaseOptions(env.ACCESS_TOKEN_EXPIRES_IN_SEC, configuredDomain)
    );
    response.cookies.set(
      REFRESH_COOKIE,
      refreshToken,
      getCookieBaseOptions(env.REFRESH_TOKEN_EXPIRES_IN_SEC, configuredDomain)
    );

    // Clear host-only scope to avoid legacy duplicate-cookie ambiguity.
    appendCookie(response, ACCESS_COOKIE, "", 0);
    appendCookie(response, REFRESH_COOKIE, "", 0);

    if (env.NODE_ENV === "production" && configuredDomain !== DEFAULT_PROD_COOKIE_DOMAIN) {
      appendCookie(response, ACCESS_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
      appendCookie(response, REFRESH_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
    }
    return;
  }

  response.cookies.set(ACCESS_COOKIE, accessToken, getCookieBaseOptions(env.ACCESS_TOKEN_EXPIRES_IN_SEC));
  response.cookies.set(REFRESH_COOKIE, refreshToken, getCookieBaseOptions(env.REFRESH_TOKEN_EXPIRES_IN_SEC));

  if (env.NODE_ENV === "production") {
    // Clear historical shared-domain cookies from old releases.
    appendCookie(response, ACCESS_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
    appendCookie(response, REFRESH_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
  }
}

export function clearAuthCookies(response: NextResponse): void {
  const env = getEnv();
  const configuredDomain = getConfiguredCookieDomain();

  if (configuredDomain) {
    response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0, configuredDomain), maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0, configuredDomain), maxAge: 0 });

    appendCookie(response, ACCESS_COOKIE, "", 0);
    appendCookie(response, REFRESH_COOKIE, "", 0);

    if (env.NODE_ENV === "production" && configuredDomain !== DEFAULT_PROD_COOKIE_DOMAIN) {
      appendCookie(response, ACCESS_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
      appendCookie(response, REFRESH_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
    }
    return;
  }

  response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });

  if (env.NODE_ENV === "production") {
    appendCookie(response, ACCESS_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
    appendCookie(response, REFRESH_COOKIE, "", 0, DEFAULT_PROD_COOKIE_DOMAIN);
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
