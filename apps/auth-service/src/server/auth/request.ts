import { authCookieNames } from "@/server/auth/cookies";

export function readBearerOrAccessCookie(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const [prefix, token] = authorization.split(" ");
    if (prefix === "Bearer" && token) {
      return token;
    }
  }

  const cookie = request.headers.get("cookie") ?? "";
  const accessCookie = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${authCookieNames.access}=`));

  return accessCookie?.slice(accessCookie.indexOf("=") + 1);
}

export function readRefreshFromBodyOrCookie(request: Request, bodyRefresh?: string): string | undefined {
  if (bodyRefresh) {
    return bodyRefresh;
  }

  const cookie = request.headers.get("cookie") ?? "";
  const refreshCookie = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${authCookieNames.refresh}=`));

  return refreshCookie?.slice(refreshCookie.indexOf("=") + 1);
}
