import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

function getCookieBaseOptions(maxAge: number) {
  const env = getEnv();

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {})
  };
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  const env = getEnv();

  response.cookies.set(ACCESS_COOKIE, accessToken, getCookieBaseOptions(env.ACCESS_TOKEN_EXPIRES_IN_SEC));
  response.cookies.set(REFRESH_COOKIE, refreshToken, getCookieBaseOptions(env.REFRESH_TOKEN_EXPIRES_IN_SEC));
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...getCookieBaseOptions(0), maxAge: 0 });
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
